const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const tvService = require('./tvService');

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

const roomHosts = new Map(); // Store host userId for each room
const roomMedia = new Map(); // Store playing media per room
const roomConfig = new Map(); // Store { isPublic, password }
const roomYtState = new Map(); // Store yt playback state
const roomViewerControl = new Map(); // Store boolean for viewer control

const userSockets = new Map(); // socket.id -> userId
const activeUsers = new Map(); // userId -> Set of socket.ids

io.on('connection', (socket) => {
    const userId = socket.handshake.query.userId || socket.id;
    userSockets.set(socket.id, userId);
    
    if (!activeUsers.has(userId)) {
        activeUsers.set(userId, new Set());
    }
    activeUsers.get(userId).add(socket.id);

    console.log(`User connected: ${socket.id} (UID: ${userId})`);
    io.emit('active-users-count', activeUsers.size);

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
            roomHosts.set(roomId, userSockets.get(socket.id));
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

        const userId = userSockets.get(socket.id);
        const existingRoom = io.sockets.adapter.rooms.get(roomId);
        if (existingRoom) {
            // Convert to array to avoid modifying the set while iterating
            const existingSocketIds = Array.from(existingRoom);
            for (const existingSocketId of existingSocketIds) {
                if (existingSocketId !== socket.id && userSockets.get(existingSocketId) === userId) {
                    const existingSocket = io.sockets.sockets.get(existingSocketId);
                    if (existingSocket) {
                        console.log(`Force disconnecting stale socket ${existingSocketId} for user ${userId} in room ${roomId}`);
                        existingSocket.disconnect(true);
                    }
                }
            }
        }

        socket.join(roomId);
        console.log(`User ${socket.id} (${socket.nickname}) joined room: ${roomId}`);
        if (callback) callback({ success: true });

        const room = io.sockets.adapter.rooms.get(roomId);
        const usersInRoom = room ? Array.from(room) : [];

        socket.emit('room-users', usersInRoom.filter(id => id !== socket.id));
        socket.to(roomId).emit('user-joined', socket.id);
        
        const usersData = usersInRoom.map(id => ({ id, nickname: io.sockets.sockets.get(id)?.nickname || 'Unknown', isHost: userSockets.get(id) === roomHosts.get(roomId) }));
        io.to(roomId).emit('room-user-list', usersData);
        
        if (roomMedia.has(roomId)) {
            socket.emit('play-media', roomMedia.get(roomId));
        }
        
        if (roomYtState.has(roomId)) {
            socket.emit('yt-sync', roomYtState.get(roomId));
        }
        
        if (roomViewerControl.has(roomId)) {
            socket.emit('viewer-control-toggled', roomViewerControl.get(roomId));
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
        roomYtState.delete(roomId);
        roomViewerControl.delete(roomId);
        socket.to(roomId).emit('stop-media');
        io.emit('public-rooms-updated');
    });

    // YouTube / Synchronized Playback Events
    socket.on('yt-sync', (data) => {
        roomYtState.set(data.roomId, data);
        // Relay to everyone else in the room
        socket.to(data.roomId).emit('yt-sync', data);
    });

    socket.on('toggle-viewer-control', (data) => {
        roomViewerControl.set(data.roomId, data.enabled);
        io.to(data.roomId).emit('viewer-control-toggled', data.enabled);
    });

    // Handle Disconnects & Host Migration
    socket.on('disconnecting', () => {
        const userId = userSockets.get(socket.id);
        for (const room of socket.rooms) {
            if (room !== socket.id) {
                if (roomHosts.get(room) === userId) {
                    const clients = Array.from(io.sockets.adapter.rooms.get(room) || []).filter(id => id !== socket.id);
                    const stillHasHost = clients.some(id => userSockets.get(id) === userId);
                    
                    if (!stillHasHost) {
                        socket.to(room).emit('user-disconnected', socket.id);
                        const usersData = clients.map(id => ({ id, nickname: io.sockets.sockets.get(id)?.nickname || 'Unknown', isHost: userSockets.get(id) === userId }));
                        io.to(room).emit('room-user-list', usersData);
                        
                        // 15-second grace period for host to reconnect
                        setTimeout(() => {
                            const currentRoom = io.sockets.adapter.rooms.get(room);
                            if (currentRoom && roomHosts.get(room) === userId) {
                                const currentClients = Array.from(currentRoom);
                                const hostReturned = currentClients.some(id => userSockets.get(id) === userId);
                                
                                if (!hostReturned && currentClients.length > 0) {
                                    const newHostSocket = currentClients[Math.floor(Math.random() * currentClients.length)];
                                    const newHostUserId = userSockets.get(newHostSocket);
                                    roomHosts.set(room, newHostUserId);
                                    io.to(newHostSocket).emit('host-migrated');
                                    
                                    const updatedUsersData = currentClients.map(id => ({ id, nickname: io.sockets.sockets.get(id)?.nickname || 'Unknown', isHost: userSockets.get(id) === newHostUserId }));
                                    io.to(room).emit('room-user-list', updatedUsersData);
                                } else if (!hostReturned && currentClients.length === 0) {
                                    roomHosts.delete(room);
                                    roomConfig.delete(room);
                                    roomMedia.delete(room);
                                    roomYtState.delete(room);
                                    roomViewerControl.delete(room);
                                    io.emit('public-rooms-updated');
                                }
                            }
                        }, 15000);
                    }
                } else {
                    socket.to(room).emit('user-disconnected', socket.id);
                    const clients = Array.from(io.sockets.adapter.rooms.get(room) || []).filter(id => id !== socket.id);
                    const usersData = clients.map(id => ({ id, nickname: io.sockets.sockets.get(id)?.nickname || 'Unknown', isHost: userSockets.get(id) === roomHosts.get(room) }));
                    io.to(room).emit('room-user-list', usersData);
                    io.emit('public-rooms-updated');
                }
            }
        }
    });

    socket.on('pass-host', (data) => {
        const roomId = data.roomId;
        const targetId = data.targetId;
        if (roomHosts.get(roomId) === userSockets.get(socket.id)) {
            const targetUserId = userSockets.get(targetId);
            roomHosts.set(roomId, targetUserId);
            io.to(targetId).emit('host-migrated');
            socket.emit('host-demoted');
            const room = io.sockets.adapter.rooms.get(roomId);
            const usersInRoom = room ? Array.from(room) : [];
            const usersData = usersInRoom.map(id => ({ id, nickname: io.sockets.sockets.get(id)?.nickname || 'Unknown', isHost: userSockets.get(id) === targetUserId }));
            io.to(roomId).emit('room-user-list', usersData);
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        const uid = userSockets.get(socket.id);
        if (uid && activeUsers.has(uid)) {
            activeUsers.get(uid).delete(socket.id);
            if (activeUsers.get(uid).size === 0) {
                activeUsers.delete(uid);
            }
        }
        userSockets.delete(socket.id);
        io.emit('active-users-count', activeUsers.size);
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

const https = require('https');

app.get('/api/yt/search', async (req, res) => {
    try {
        const query = req.query.q;
        const pageToken = req.query.pageToken;

        if (!query) {
            return res.status(400).json({ error: 'Missing query parameter' });
        }

        const apiKey = process.env.YOUTUBE_API_KEY;
        
        if (!apiKey) {
            return res.status(500).json({ error: 'YOUTUBE_API_KEY environment variable is missing.' });
        }

        let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${encodeURIComponent(query)}&type=video&key=${apiKey}`;
        if (pageToken) {
            url += `&pageToken=${encodeURIComponent(pageToken)}`;
        }
        
        https.get(url, (response) => {
            let data = '';
            response.on('data', (chunk) => { data += chunk; });
            response.on('end', () => {
                if (response.statusCode !== 200) {
                    console.error('YouTube API Error Response:', data);
                    return res.status(500).json({ error: 'YouTube API returned an error. Check server logs.' });
                }
                try {
                    const parsedData = JSON.parse(data);
                    if (!parsedData.items) {
                        return res.status(500).json({ error: 'Invalid response from YouTube API' });
                    }
                    const videos = parsedData.items.map(item => {
                        let formattedDate = 'Unknown Date';
                        if (item.snippet.publishedAt) {
                            const date = new Date(item.snippet.publishedAt);
                            formattedDate = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                        }

                        return {
                            videoId: item.id.videoId,
                            title: item.snippet.title,
                            thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
                            author: { name: item.snippet.channelTitle },
                            timestamp: formattedDate
                        };
                    });
                    res.json({ results: videos, nextPageToken: parsedData.nextPageToken });
                } catch (parseErr) {
                    console.error('YouTube API Parse Error:', parseErr);
                    res.status(500).json({ error: 'Failed to parse YouTube API response' });
                }
            });
        }).on('error', (err) => {
            console.error('HTTPS Get Error:', err.message);
            res.status(500).json({ error: 'Network error reaching YouTube API' });
        });

    } catch (err) {
        console.error('Search Route Catch Error:', err);
        res.status(500).json({ error: 'Failed to search YouTube', details: err.message });
    }
});

// Television (Live TV Directory & HLS Proxy)
app.get('/api/tv/meta', async (req, res) => {
    try {
        const localCountry = typeof req.query.localCountry === 'string' ? req.query.localCountry : 'PH';
        const data = await tvService.getTvMeta(localCountry);
        res.json(data);
    } catch (err) {
        console.error('TV Meta Error:', err);
        res.status(500).json({ error: 'Failed to load television metadata' });
    }
});

app.get('/api/tv/featured', async (req, res) => {
    try {
        const localCountry = typeof req.query.localCountry === 'string' ? req.query.localCountry : 'PH';
        const data = await tvService.getFeaturedTvShelves(localCountry);
        res.json(data);
    } catch (err) {
        console.error('TV Featured Error:', err);
        res.status(500).json({ error: 'Failed to load featured channels' });
    }
});

app.get('/api/tv/channels', async (req, res) => {
    try {
        const data = await tvService.queryTvChannels({
            category: req.query.category,
            scope: req.query.scope,
            country: req.query.country,
            localCountry: req.query.localCountry,
            q: req.query.q,
            page: req.query.page,
            limit: req.query.limit
        });
        res.json(data);
    } catch (err) {
        console.error('TV Channels Error:', err);
        res.status(500).json({ error: 'Failed to query television channels' });
    }
});

app.get('/api/tv/proxy', (req, res) => {
    tvService.proxyStream(req, res);
});

app.get('/api/pbb/feeds', (req, res) => {
    try {
        const data = tvService.getPbbFeeds();
        res.json(data);
    } catch (err) {
        console.error('PBB Feeds Error:', err);
        res.status(500).json({ error: 'Failed to load PBB feeds' });
    }
});

app.get('/api/pbb/stream', async (req, res) => {
    try {
        const data = await tvService.getLivePbbStream();
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.json(data);
    } catch (err) {
        console.error('PBB Stream Metadata Error:', err);
        res.status(500).json({ error: 'Failed to fetch PBB stream metadata' });
    }
});

app.get('/api/pbb/mpd/:channel', async (req, res) => {
    try {
        const xml = await tvService.getLivePbbMpd(req.params.channel);
        if (xml) {
            res.setHeader('Content-Type', 'application/dash+xml');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'public, max-age=2');
            res.send(xml);
        } else {
            res.status(502).send('Failed to fetch manifest');
        }
    } catch (err) {
        console.error('PBB MPD Proxy Error:', err);
        res.status(500).send('Manifest proxy error');
    }
});

// Proxy Akamai DASH segments for iOS and clients that cannot use direct bridge fetch
app.use('/dash/live', async (req, res) => {
    const targetUrl = 'https://absp-live.akamaized.net/dash/live' + req.url;
    try {
        const upstream = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
                'Origin': 'null'
            },
            signal: AbortSignal.timeout(15000)
        });
        if (!upstream.ok) {
            return res.status(upstream.status).end();
        }
        res.setHeader('Access-Control-Allow-Origin', '*');
        const ct = upstream.headers.get('content-type');
        if (ct) res.setHeader('Content-Type', ct);
        const { Readable } = require('stream');
        Readable.fromWeb(upstream.body).pipe(res);
    } catch (err) {
        res.status(502).end();
    }
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
    // Pre-warm Television directory in background
    tvService.ensureTvIndex().catch((err) => {
        console.error('[Television] Warm-up failed:', err.message);
    });
});
