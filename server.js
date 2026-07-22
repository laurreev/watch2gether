const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Enable CORS for development
app.use(cors());

// Configure Socket.io
const io = new Server(server, {
    cors: {
        origin: '*', // In production, we'll serve from the same origin, but it's okay for signaling
        methods: ['GET', 'POST']
    }
});

const roomHosts = new Map();
const roomMedia = new Map(); // Store playing media per room
const roomConfig = new Map(); // Store { isPublic, password }

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Check if room exists and if it requires a password
    socket.on('check-room', (roomId, callback) => {
        const room = io.sockets.adapter.rooms.get(roomId);
        if (room) {
            const config = roomConfig.get(roomId);
            callback({ exists: true, isPublic: config?.isPublic, requiresPassword: config?.password !== '' });
        } else {
            callback({ exists: false });
        }
    });

    // User joins a room
    socket.on('join-room', (data, callback) => {
        const roomId = data.roomId;
        const isOwner = data.isOwner;
        const attemptedPassword = data.password;
        
        socket.nickname = data.nickname || `User-${socket.id.substring(0,4)}`;

        if (isOwner) {
            roomConfig.set(roomId, { isPublic: data.isPublic, password: data.password || '' });
            roomHosts.set(roomId, socket.id);
        } else {
            if (roomConfig.has(roomId)) {
                const config = roomConfig.get(roomId);
                if (!config.isPublic && config.password && config.password !== attemptedPassword) {
                    if (callback) callback({ success: false, message: 'Invalid password' });
                    return;
                }
            } else {
                if (callback) callback({ success: false, message: 'Room not found' });
                return;
            }
        }

        socket.join(roomId);
        console.log(`User ${socket.id} (${socket.nickname}) joined room: ${roomId}`);
        if (callback) callback({ success: true });

        const room = io.sockets.adapter.rooms.get(roomId);
        const usersInRoom = room ? Array.from(room) : [];

        socket.emit('room-users', usersInRoom.filter(id => id !== socket.id));
        socket.to(roomId).emit('user-joined', socket.id);
        
        const usersData = usersInRoom.map(id => ({ id, nickname: io.sockets.sockets.get(id)?.nickname || 'Unknown' }));
        io.to(roomId).emit('room-user-list', usersData);
        
        if (roomMedia.has(roomId)) {
            socket.emit('play-media', roomMedia.get(roomId));
        }

        if (roomConfig.get(roomId)?.isPublic) {
            io.emit('public-rooms-updated');
        }
    });

    // Chat
    socket.on('chat-message', (data) => {
        io.to(data.roomId).emit('chat-message', data);
    });

    // WebRTC Signaling: Relay Offer
    socket.on('offer', (data) => {
        socket.to(data.to).emit('offer', { from: socket.id, offer: data.offer });
    });

    // WebRTC Signaling: Relay Answer
    socket.on('answer', (data) => {
        socket.to(data.to).emit('answer', { from: socket.id, answer: data.answer });
    });

    // WebRTC Signaling: Relay ICE Candidate
    socket.on('ice-candidate', (data) => {
        socket.to(data.to).emit('ice-candidate', { from: socket.id, candidate: data.candidate });
    });

    socket.on('stop-sharing', (roomId) => {
        socket.to(roomId).emit('stop-sharing');
    });

    socket.on('play-media', (data) => {
        roomMedia.set(data.roomId, data.media);
        socket.to(data.roomId).emit('play-media', data.media);
        io.emit('public-rooms-updated');
    });

    socket.on('stop-media', (roomId) => {
        roomMedia.delete(roomId);
        socket.to(roomId).emit('stop-media');
        io.emit('public-rooms-updated');
    });

    // Handle Disconnects & Host Migration
    socket.on('disconnecting', () => {
        for (const room of socket.rooms) {
            if (room !== socket.id) {
                if (roomHosts.get(room) === socket.id) {
                    const clients = Array.from(io.sockets.adapter.rooms.get(room) || []).filter(id => id !== socket.id);
                    if (clients.length > 0) {
                        const newHost = clients[Math.floor(Math.random() * clients.length)];
                        roomHosts.set(room, newHost);
                        io.to(newHost).emit('host-migrated');
                        socket.to(room).emit('user-disconnected', socket.id);
                        
                        const usersData = clients.map(id => ({ id, nickname: io.sockets.sockets.get(id)?.nickname || 'Unknown' }));
                        io.to(room).emit('room-user-list', usersData);
                    } else {
                        roomHosts.delete(room);
                        roomConfig.delete(room);
                        roomMedia.delete(room);
                        io.emit('public-rooms-updated');
                    }
                } else {
                    socket.to(room).emit('user-disconnected', socket.id);
                    const clients = Array.from(io.sockets.adapter.rooms.get(room) || []).filter(id => id !== socket.id);
                    const usersData = clients.map(id => ({ id, nickname: io.sockets.sockets.get(id)?.nickname || 'Unknown' }));
                    io.to(room).emit('room-user-list', usersData);
                    io.emit('public-rooms-updated');
                }
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;

// API endpoint to fetch all public rooms
app.get('/api/rooms', (req, res) => {
    const publicRooms = [];
    for (const [roomId, config] of roomConfig.entries()) {
        if (config.isPublic) {
            const room = io.sockets.adapter.rooms.get(roomId);
            if (room) {
                publicRooms.push({
                    roomId,
                    viewerCount: room.size,
                    media: roomMedia.get(roomId) || null
                });
            }
        }
    }
    res.json(publicRooms);
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'frontend/dist')));

    app.get(/.*/, (req, res, next) => {
        if (req.path.startsWith('/api/')) return next();
        res.sendFile(path.join(__dirname, 'frontend/dist', 'index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.send('Signaling server is running.');
    });
}

app.get('/api/room/:id', (req, res) => {
    const room = io.sockets.adapter.rooms.get(req.params.id);
    if (room) {
        const config = roomConfig.get(req.params.id);
        res.json({ exists: true, isPublic: config?.isPublic, requiresPassword: config?.password !== '' });
    } else {
        res.json({ exists: false });
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Signaling server listening on port ${PORT}`);
});
