<div align="center">
  <h1>🍿 Watch2gether</h1>
  <p>
    <strong>A real-time synchronized media viewing experience with WebRTC screen sharing and dynamic streaming capabilities.</strong>
  </p>
  <p>
    <a href="#features">Features</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#how-it-works">How It Works</a>
  </p>
</div>

<br />

Watch2gether is a powerful, lightweight synchronized media player built for watching movies and TV shows with friends. It uses a **Host-Viewer P2P WebRTC architecture** to ensure latency-free syncing and leverages the **TMDB API** with **Vidsrc streaming embeds** for a seamless, client-side only media fetching experience.

---

## ✨ Features

* **🎥 Low-Latency Sync**: P2P WebRTC connection ensures all viewers are perfectly synced with the host without server bottleneck.
* **🌐 Universal Media Scraper**: Integrated TMDB API instantly fetches rich metadata, posters, and detailed episode lists for any movie or TV show.
* **📜 Infinite Scrolling**: Seamless, paginated TMDB browsing experience.
* **📺 Anime & Asian Drama Support**: Specialized discover tabs instantly pull culturally specific trending content natively.
* **⚡ Blazing Fast**: Zero backend processing! Search and streaming resolution happens 100% on the client side without headless browsers or heavy server loads.
* **🛡️ Redundant Streaming**: Automatically generates standard embed links across four independent providers (Vidsrc, 2Embed, Multiembed, and Vidlink for Anime) to stream high-quality video instantly in native iframes.
* **🍿 Binge-Ready Player**: An embedded Season/Episode picker mounts directly below the player, allowing instant switching without reopening search menus.
* **💬 Live Text Chat**: Integrated scrolling chat panel allowing users to coordinate watch parties with ease.
* **🎭 Theater Mode**: One-click immersive viewing that hides all extra UI for a cinematic experience.
* **🔄 Persistent Auto-Rejoin**: Drop out accidentally? Browsers seamlessly store session data, instantly re-entering the room upon refresh.
* **👑 Host Migration**: When the host disconnects, the server gracefully elevates a random viewer to become the new Room Host to keep the party alive.
* **🚪 Public & Private Rooms**: Browse available open rooms on the global live list or lock down your movie night with passwords.
* **🎨 Modern UI**: Built with React and styled beautifully with a glassmorphic dark-mode design.

## 🏗️ Architecture

The app is split into two highly optimized components:

1. **Frontend (`/frontend`)**: React + TypeScript + Vite. Handles the UI, WebRTC media stream rendering, TMDB searching, and the interactive Vidsrc media player.
2. **Signaling Server (`server.js`)**: A lightweight Node.js + Express + Socket.io server that acts as a broker for WebRTC SDP offers/answers, and coordinates media playback synchronization between peers.

## 🚀 Getting Started

### Prerequisites
* Node.js (v18+ recommended)
* A free TMDB API Key from [The Movie Database](https://www.themoviedb.org/)

### 1. Install Node Dependencies
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
```

### 2. Configure Environment Variables
Create a `.env` file inside the `frontend` directory and add your TMDB API Key:
```env
VITE_TMDB_API_KEY=your_tmdb_api_key_here
```

### 3. Run the Development Servers
Open two terminal instances.

**Terminal 1 (Backend Node Server):**
```bash
npm run dev
```

**Terminal 2 (Frontend React Server):**
```bash
cd frontend
npm run dev
```

Your app will be live at `http://localhost:5173`!

## 🛠️ How It Works

Watch2gether focuses on making media synchronization incredibly efficient:

1. **Client-Side Searching**: The React app directly hits `api.themoviedb.org` to search for movies or TV shows, bypassing your backend entirely.
2. **Dynamic Episode Resolution**: For TV shows, the app automatically fetches the specific season's episode list, rendering real episode titles dynamically.
3. **Stateless Embeds**: Once an episode or movie is selected, the frontend instantly constructs a stateless `vidsrc.me/embed` URL using the TMDB ID.
4. **Socket Synchronization**: When the Host plays media, a lightweight JSON packet containing the media info is broadcast to all viewers in the room. The viewers' browsers catch this packet and instantly load the same iframe!

For a full deep dive, check out the [Architecture Docs](watch2gether_architecture.md).

---
<div align="center">
  <p>Built with ❤️ for synchronized watching.</p>
</div>
