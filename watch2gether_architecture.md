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

### The Search Workflow & Infinite Scrolling
1. When a user types a query, `vaporpic.ts` dynamically hits `https://api.themoviedb.org/3/search/multi` (or specific movie/tv endpoints).
2. **Infinite Scrolling:** The search and discovery tabs leverage an `onScroll` pagination engine. When the user scrolls near the bottom of the grid, a new request is fired for `page=N+1`, seamlessly merging the new results into the existing grid without reloading.
3. If the user clears the search bar on the **All** or **Movie/TV** tabs, it smartly falls back to `https://api.themoviedb.org/3/trending/all/day` to provide immediate recommendations.
4. If the user clears the search bar on the **Anime** or **Asian** tabs, it triggers specialized `/discover/tv` queries (filtering by Japanese animation genres or Korean/Chinese/Thai languages) to surface culturally-specific trending content automatically.
5. The results are parsed and mapped into unified `MediaItem` objects.

### Dynamic TV Show Resolution
Unlike movies, TV shows require deep contextual logic (Seasons and Episodes).
1. When a TV Show, Anime, or Asian Drama is selected, the frontend instantly calls `getTvSeasons()` to retrieve the array of available seasons.
2. When the user changes the Season dropdown, a highly specific call to `getEpisodesForSeason(tmdbId, seasonNumber)` is made.
3. This populates the UI with actual **Episode Titles** and thumbnails (rather than generic numbers), offering a premium browsing experience without ever touching your Node.js backend.
4. **Binge-Watching Support**: Once a series is playing, an embedded Season/Episode picker dynamically mounts underneath the video player in `ScreenShare.tsx`. This allows the host to instantly switch to the next episode without ever reopening the search menu.

## 4. The Vidsrc Streaming Engine

The actual video playback leverages **Vidsrc**, a stateless video embed provider that perfectly aligns with TMDB IDs. 

### The Magic of Stateless Embeds
Previously, the app required a heavy Python backend to reverse-engineer Cloudflare protections and generate complex AES-GCM encrypted tokens for Fmovies. 

With the new architecture, generating a video stream is instant and requires **zero encryption overhead**. The frontend relies on four redundant, stateless embed networks:
*   **Server 1 (Vidsrc ME):** `https://vidsrc.me/embed/movie?tmdb={tmdbId}`
*   **Server 2 (2Embed):** `https://www.2embed.cc/embed/{tmdbId}`
*   **Server 3 (Multiembed):** `https://multiembed.mov/?video_id={tmdbId}&tmdb=1`
*   **Server 4 (Vidlink):** `https://vidlink.pro/movie/{tmdbId}` (Optimized for Anime)

TV Show routing dynamically injects the season and episode parameters depending on the active server format (e.g., `&season={s}&episode={e}` for Vidsrc, or `&s={s}&e={e}` for 2Embed and Multiembed).

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
