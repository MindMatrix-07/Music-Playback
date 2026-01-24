# Music Playback & Metadata Explorer

A sophisticated web application that integrates music streaming (Spotify & Apple Music) with deep metadata exploration, offering a unified interface for discovery and playback.

## 🎵 Key Features

### 🎧 Dual Platform Streaming
- **Spotify Integration**: Full searching and playback capability (requires Premium for full tracks, 30s preview for others). Implicit Grant flow for secure client-side authentication.
- **Apple Music**: Direct search and embed integration.
- **Smart Switching**: Seamlessly toggle between platforms while maintaining context.

### 🧠 Deep Metadata Engine
- **Aggregated Data**: Combines data from **MusicBrainz** (credits, release info), **Wikidata** (images, relationships), and **Spotify/Apple** (streaming data).
- **Artist Images**: Automatically fetches high-quality artist images from Wikidata/Wikimedia Commons.
- **Technical Details**: Displays ISRC, Record Label, Release Date, and Genre tags.

### 📺 Intelligent Video Matching
- **Official YouTube Embed**: Utilizes advanced video matching to find and display the correct official video for the currently selected track, ensuring seamless playback.
- **Smart Fallback**: Automatically handles cases where direct video matching might need alternative search criteria.

### 📝 Reference Lyrics
- **Integrated Lyrics Viewer**: Displays accurate synchronous or plain text lyrics sourced from open community databases.
- **User Friendly**: Dedicated section with a "Copy" button and a clear "Reference Only" disclaimer.
- **Isolated UI**: Clean, non-intrusive layout located below the main media player.

## 🛠️ Architecture

### Frontend
- **Vanilla HTML/CSS/JS**: Fast, lightweight, and dependency-free frontend.
- **Glassmorphism Design**: Modern UI with dynamic gradients (`.spotify-active`, `.apple-active`) and smooth animations.
- **Responsive**: Fully optimized for Desktop and Mobile layouts.

### Backend (Serverless)
- **Vercel Functions**: API routes handling secure communication and data aggregation.
    - `/api/spotify-login`: Handles OAuth authentication.
    - `/api/get-metadata`: Central aggregator for track information.
    - `/api/get-lyrics`: Fetches lyrics from external providers.
    - `/api/mb/*`: Database interactions.

## 🔌 Integration & Data
- **Spotify Web API**: Search, Auth, Playback.
- **Apple MusicKit JS**: Embeds and Search.
- **MusicBrainz**: Core metadata relationships.
- **Wikidata**: Media assets.
- **LRCLIB**: Lyrics integration.
- **YouTube**: Video sourcing.

## 🚀 Getting Started

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/music-playback.git
   cd music-playback
   ```

2. **Install Vercel CLI** (for local development)
   ```bash
   npm i -g vercel
   ```

3. **Environment Setup**
   Ensure your `vercel.json` and backend scripts are configured with necessary CLIENT_IDs (if strict env vars are used, though this project currently uses public endpoints/client-side tokens where possible).

4. **Run Locally**
   ```bash
   vercel dev
   ```

5. **Deploy**
   Push to GitHub and connect to Vercel for automatic deployment.

---
*Created for educational purposes.*
