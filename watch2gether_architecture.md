# Watch2gether Architecture & Media Workflow

Watch2gether is a real-time synchronized media viewing application. It uses a **React (Vite)** frontend and a **Node.js + Socket.io** signaling server. The application is completely serverless when it comes to media fetching—all video streams and metadata are resolved entirely on the client side using the TMDB API and Vidsrc.

## 1. High-Level Architecture

*   **Frontend (React/TypeScript)**: Handles user interaction, TMDB media searching, episode fetching, WebRTC video streaming, and Vidsrc video playback.
*   **Signaling Server (Node.js/Socket.io)**: Brokers the connection between peers for WebRTC. Handles `offer`, `answer`, and `ice-candidate` exchanges. It also tracks the currently playing media state so late joiners can instantly sync.

## 2. WebRTC Screen Sharing Workflow

Instead of forcing all users to individually request the media stream (which could cause desync and multiple API rate-limits), Watch2gether utilizes a **Host-Viewer model**:

1.  **Room Creation**: The Host creates a room. The Node server stores the Host's `socket.id`.
2.  **WebRTC Negotiation**: When a Viewer joins, the server signals the Host. The Host generates an SDP `offer` and sends it via Socket.io. The Viewer replies with an `answer`.
3.  **Screen Capture**: The Host's browser captures the local video stream (or the playing media) using `getDisplayMedia` or by capturing the video element's stream directly.
4.  **P2P Streaming**: The video stream is transmitted peer-to-peer (P2P) from the Host to all Viewers with extremely low latency.

## 3. Client-Side Media Fetching (TMDB)

Watch2gether offloads all scraping and database overhead by utilizing **The Movie Database (TMDB)** as the source of truth.

### The Search Workflow
1. When a user types a query, `vaporpic.ts` dynamically hits `https://api.themoviedb.org/3/search/multi` (or specific movie/tv endpoints).
2. If the user clears the search bar, it smartly falls back to `https://api.themoviedb.org/3/trending/all/day` to provide immediate recommendations.
3. The results are parsed and mapped into unified `MediaItem` objects.

### Dynamic TV Show Resolution
Unlike movies, TV shows require deep contextual logic (Seasons and Episodes).
1. When a TV Show is selected, the frontend instantly calls `getTvSeasons()` to retrieve the array of available seasons.
2. When the user changes the Season dropdown, a highly specific call to `getEpisodesForSeason(tmdbId, seasonNumber)` is made.
3. This populates the UI with actual **Episode Titles** and thumbnails (rather than generic numbers), offering a premium browsing experience without ever touching your Node.js backend.

## 4. The Vidsrc Streaming Engine

The actual video playback leverages **Vidsrc**, a stateless video embed provider that perfectly aligns with TMDB IDs. 

### The Magic of Stateless Embeds
Previously, the app required a heavy Python backend to reverse-engineer Cloudflare protections and generate complex AES-GCM encrypted tokens for Fmovies. 

With the Vidsrc architecture, generating a video stream is instant and requires **zero encryption overhead**:
*   **For Movies:** The URL is assembled cleanly as `https://vidsrc.me/embed/movie?tmdb={tmdbId}`.
*   **For TV Shows:** The URL dynamically injects the season and episode parameters: `https://vidsrc.me/embed/tv?tmdb={tmdbId}&season={seasonNum}&episode={episodeNum}`.

### 5. Media Synchronization 

Because Vidsrc embeds do not rely on IP-locked auth tokens, synchronizing media across peers is incredibly straightforward:

1. **Host Plays Media**: The host selects a movie/episode. The frontend generates the Vidsrc URL and embeds it in an `<iframe>`.
2. **Socket Broadcast**: The host emits a lightweight JSON packet containing the TMDB ID, Season, and Episode to the Signaling Server.
3. **Instant Viewer Sync**: The server broadcasts this packet. Every Viewer's browser independently regenerates the exact same Vidsrc embed URL and loads the iframe.
4. **Late Joiners**: If a viewer joins halfway through, the Signaling Server automatically pushes the active media packet to them instantly upon connection!

## Nerd Stats summary
*   **Backend CPU Usage for Media**: 0.0% (Fully client-side)
*   **Token Generation Time**: 0ms (Stateless string interpolation)
*   **CORS Restrictions**: Automatically bypassed via `<iframe>` rendering
*   **Database**: TMDB Community API
