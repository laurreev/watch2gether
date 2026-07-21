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

Watch2gether is a powerful, lightweight synchronized media player built for watching movies and anime with friends. It uses a **Host-Viewer P2P WebRTC architecture** to ensure latency-free syncing and a native **Python-based Crypto Extraction Engine** to seamlessly bypass bot protections on top streaming sites.

---

## ✨ Features

* **🎥 Low-Latency Sync**: P2P WebRTC connection ensures all viewers are perfectly synced with the host without server bottleneck.
* **🌐 Universal Media Scraper**: Integrated Python backend dynamically queries media, parsing through Cloudflare and generating custom AES-GCM tokens.
* **⚡ Blazing Fast**: Token generation and fetching happen in less than a second—bypassing the need for heavy headless browser scraping.
* **🛡️ CORS Bypass**: Utilizes smart iframe injection on the frontend to completely bypass cross-origin restrictions on media streams.
* **🎨 Modern UI**: Built with React and styled beautifully with a glassmorphic dark-mode design.

## 🏗️ Architecture

The app is split into three main components:

1. **Frontend (`/frontend`)**: React + TypeScript + Vite. Handles the UI, WebRTC media stream rendering, and the interactive media search/player.
2. **Signaling Server (`server.js`)**: A Node.js + Express + Socket.io server that acts as a broker for WebRTC SDP offers/answers, and acts as a bridge for the Python engine.
3. **Extraction Engine (`simple.py`)**: A Python script utilizing `requests`, `pycryptodome`, and `beautifulsoup4` to reverse-engineer client-side streaming logic and generate valid Netoda URL hashes.

## 🚀 Getting Started

### Prerequisites
* Node.js (v18+ recommended)
* Python 3.9+
* Pip

### 1. Install Python Dependencies
```bash
pip install requests beautifulsoup4 pycryptodome playwright
playwright install chromium
```

### 2. Install Node Dependencies
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
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

## 🛠️ How It Works (The Extraction Magic)

The magic of Watch2gether lies in its ability to securely extract media without triggering Cloudflare bot protection:

1. **Geolocation Mapping**: The backend securely fetches your Cloudflare `loc` (e.g., `US`, `PH`) using a trace request.
2. **Payload Generation**: A specific plaintext payload is assembled combining the Media ID, Episode, Server, `loc`, and a UNIX Timestamp.
3. **AES-GCM Encryption**: Using a SHA-256 hash of your `loc` as the key, the payload is encrypted using AES-GCM, yielding a ciphertext, IV, and auth tag.
4. **Base64url Magic**: The binary string is double Base64 encoded (specifically using URL-safe modifications) and injected directly into the iframe source.
5. **Native Loading**: The React UI loads this generated URL in an `<iframe>`, skipping all CORS restrictions!

For a full deep dive, check out the [Architecture Docs](watch2gether_architecture.md).

---
<div align="center">
  <p>Built with ❤️ for synchronized watching.</p>
</div>
