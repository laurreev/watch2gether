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

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Check if room exists
    socket.on('check-room', (roomId, callback) => {
        const room = io.sockets.adapter.rooms.get(roomId);
        callback(room ? true : false);
    });

    // User joins a room
    socket.on('join-room', (data) => {
        const roomId = typeof data === 'string' ? data : data.roomId;
        const isOwner = typeof data === 'object' ? data.isOwner : false;

        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);

        if (isOwner) {
            roomHosts.set(roomId, socket.id);
        }

        const room = io.sockets.adapter.rooms.get(roomId);
        const usersInRoom = room ? Array.from(room) : [];

        // Notify the user who just joined about existing users
        socket.emit('room-users', usersInRoom.filter(id => id !== socket.id));

        // Notify others in the room that a new user joined
        // We send the socket.id so the existing users know who to initiate a connection with
        socket.to(roomId).emit('user-joined', socket.id);
        
        // If there's media playing, send it to the new user
        if (roomMedia.has(roomId)) {
            socket.emit('play-media', roomMedia.get(roomId));
        }
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

    // Handle stream stop
    socket.on('stop-sharing', (roomId) => {
        socket.to(roomId).emit('stop-sharing');
    });

    // Handle media playback sync
    socket.on('play-media', (data) => {
        // data: { roomId, media: { title, type, originalUrl, serverStr } }
        roomMedia.set(data.roomId, data.media);
        socket.to(data.roomId).emit('play-media', data.media);
    });

    socket.on('stop-media', (roomId) => {
        roomMedia.delete(roomId);
        socket.to(roomId).emit('stop-media');
    });

    // Handle Disconnects
    socket.on('disconnecting', () => {
        // Notify all rooms the user is in that they are leaving
        for (const room of socket.rooms) {
            if (room !== socket.id) {
                if (roomHosts.get(room) === socket.id) {
                    socket.to(room).emit('host-disconnected');
                    roomHosts.delete(room);
                } else {
                    socket.to(room).emit('user-disconnected', socket.id);
                }
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;

const { exec } = require('child_process');

// API endpoint for checking if a room exists
app.get('/api/room/:id', (req, res) => {
    const room = io.sockets.adapter.rooms.get(req.params.id);
    res.json({ exists: room ? true : false });
});

// API endpoint for searching media via Python script
app.get('/api/search', (req, res) => {
    const { q, type, genre, year } = req.query;
    const query = q || '';
    
    const mediaType = type || 'all';
    
    // Call simple.py
    const pythonScript = path.join(__dirname, 'simple.py');
    let command = `python "${pythonScript}" --action search --query "${query}" --type "${mediaType}"`;
    if (genre) command += ` --genre "${genre}"`;
    if (year) command += ` --year "${year}"`;
    
    const childProcess = exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (error) {
            // Ignore kill errors since we initiated it
            if (error.signal === 'SIGTERM') return;
            console.error(`Error executing script: ${error.message}`);
            return res.status(500).json({ error: 'Failed to search media' });
        }
        
        try {
            const results = JSON.parse(stdout);
            res.json({ results });
        } catch (parseError) {
            console.error(`Error parsing script output: ${parseError.message}`);
            console.error(`Output was: ${stdout}`);
            res.status(500).json({ error: 'Invalid response from search script' });
        }
    });

    req.on('close', () => {
        if (!res.headersSent) {
            console.log('Client aborted request, killing python process');
            childProcess.kill('SIGTERM');
        }
    });
});

// API endpoint for getting stream URL via Python script
app.get('/api/stream', (req, res) => {
    const { id } = req.query;
    if (!id) {
        return res.status(400).json({ error: 'Missing id parameter' });
    }
    
    // Call simple.py for stream
    const pythonScript = path.join(__dirname, 'simple.py');
    const command = `python "${pythonScript}" --action stream --id "${id}"`;
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error.message}`);
            return res.status(500).json({ error: 'Failed to get stream' });
        }
        
        try {
            const result = JSON.parse(stdout);
            res.json(result);
        } catch (parseError) {
            console.error(`Error parsing script output: ${parseError.message}`);
            console.error(`Output was: ${stdout}`);
            res.status(500).json({ error: 'Invalid response from stream script' });
        }
    });
});

// API endpoint for getting episode count for TV shows
app.get('/api/episodes', (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }
    
    const pythonScript = path.join(__dirname, 'simple.py');
    const command = `python "${pythonScript}" --action episodes --url "${url}"`;
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error executing script: ${error.message}`);
            return res.status(500).json({ error: 'Failed to fetch episodes' });
        }
        
        try {
            const result = JSON.parse(stdout);
            res.json(result);
        } catch (parseError) {
            console.error(`Error parsing script output: ${parseError.message}`);
            res.status(500).json({ error: 'Invalid response from episodes script' });
        }
    });
});

// API endpoint for getting iframe url via Python script extraction
// API endpoint for getting iframe url via Python script extraction
app.get('/api/extract', (req, res) => {
    const { url, server, loc, ep } = req.query;
    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }
    
    const pythonScript = path.join(__dirname, 'simple.py');
    let command = `python "${pythonScript}" --action extract --url "${url}"`;
    if (server) {
        command += ` --server "${server}"`;
    }
    if (loc) {
        command += ` --loc "${loc}"`;
    }
    if (ep) {
        command += ` --ep "${ep}"`;
    }
    
    // Set a longer timeout (30s) since Playwright needs time to load and click
    const childProcess = exec(command, { maxBuffer: 1024 * 1024 * 10, timeout: 45000 }, (error, stdout, stderr) => {
        if (error) {
            if (error.signal === 'SIGTERM' || error.signal === 'SIGKILL') return;
            console.error(`Error executing script: ${error.message}`);
            return res.status(500).json({ error: 'Failed to extract stream' });
        }
        
        try {
            const result = JSON.parse(stdout);
            res.json(result);
        } catch (parseError) {
            console.error(`Error parsing script output: ${parseError.message}`);
            console.error(`Output was: ${stdout}`);
            res.status(500).json({ error: 'Invalid response from extract script' });
        }
    });

    req.on('close', () => {
        if (!res.headersSent) {
            console.log('Client aborted request, killing python process');
            childProcess.kill('SIGTERM');
        }
    });
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

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Signaling server listening on port ${PORT}`);
});
