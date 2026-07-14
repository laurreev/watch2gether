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

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Check if room exists
    socket.on('check-room', (roomId, callback) => {
        const room = io.sockets.adapter.rooms.get(roomId);
        callback(room ? true : false);
    });

    // User joins a room
    socket.on('join-room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);
        
        const room = io.sockets.adapter.rooms.get(roomId);
        const usersInRoom = room ? Array.from(room) : [];
        
        // Notify the user who just joined about existing users
        socket.emit('room-users', usersInRoom.filter(id => id !== socket.id));

        // Notify others in the room that a new user joined
        // We send the socket.id so the existing users know who to initiate a connection with
        socket.to(roomId).emit('user-joined', socket.id);
    });

    // WebRTC Signaling: Relay Offer
    socket.on('offer', (data) => {
        // data: { to: targetSocketId, offer: sdpOffer }
        socket.to(data.to).emit('offer', { from: socket.id, offer: data.offer });
    });

    // WebRTC Signaling: Relay Answer
    socket.on('answer', (data) => {
        // data: { to: targetSocketId, answer: sdpAnswer }
        socket.to(data.to).emit('answer', { from: socket.id, answer: data.answer });
    });

    // WebRTC Signaling: Relay ICE Candidate
    socket.on('ice-candidate', (data) => {
        // data: { to: targetSocketId, candidate: RTCIceCandidate }
        socket.to(data.to).emit('ice-candidate', { from: socket.id, candidate: data.candidate });
    });

    // Handle Disconnects
    socket.on('disconnecting', () => {
        // Notify all rooms the user is in that they are leaving
        for (const room of socket.rooms) {
            if (room !== socket.id) {
                socket.to(room).emit('user-disconnected', socket.id);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;

// API endpoint for checking if a room exists
app.get('/api/room/:id', (req, res) => {
    const room = io.sockets.adapter.rooms.get(req.params.id);
    res.json({ exists: room ? true : false });
});

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
    // Serve static files from the React frontend app
    app.use(express.static(path.join(__dirname, 'frontend/dist')));
    
    // API endpoint for checking if a room exists
    app.get('/api/room/:id', (req, res) => {
        const room = io.sockets.adapter.rooms.get(req.params.id);
        res.json({ exists: room ? true : false });
    });

    // Anything that doesn't match a static file, send the React index.html
    app.get(/.*/, (req, res) => {
        res.sendFile(path.join(__dirname, 'frontend/dist', 'index.html'));
    });
} else {
    app.get('/', (req, res) => {
        res.send('Signaling server is running. In development mode, the React frontend runs on a separate port.');
    });
}

server.listen(PORT, () => {
    console.log(`Signaling server listening on port ${PORT}`);
});
