import 'dotenv/config'; // Load env vars BEFORE other imports
import express from 'express';
import cors from 'cors';
import verifyAccessHandler from './api/verify-access.js';
import searchHandler from './api/search.js';
import getMetadataHandler from './api/get-metadata.js';
import getLyricsHandler from './api/get-lyrics.js';
import spotifyLoginHandler from './api/spotify-login.js';
import spotifyCallbackHandler from './api/spotify-callback.js';

const app = express();
const PORT = 3001;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static('.'));

// Adapter for Vercel Functions
const adapter = (handler) => async (req, res) => {
    try {
        await handler(req, res);
    } catch (e) {
        console.error(e);
        if (!res.headersSent) res.status(500).json({ error: e.message });
    }
};

// API Routes
app.all('/api/verify-access', adapter(verifyAccessHandler));
app.get('/api/search', adapter(searchHandler));
app.get('/api/get-metadata', adapter(getMetadataHandler));
app.get('/api/get-lyrics', adapter(getLyricsHandler));
app.get('/api/spotify-login', adapter(spotifyLoginHandler));
app.get('/api/spotify-callback', adapter(spotifyCallbackHandler));

// Auth Status Stub (since verify-access logic implies discord/device auth check)
app.get('/api/auth/status', (req, res) => {
    // Simple check based on "auth_token" cookie presence, consistent with verify-access
    // But verify-access uses stateless JWT (jose) or similar in this version.
    // We'll just return basic true if cookie exists for now to satify frontend UI checks.
    const hasToken = req.headers.cookie && req.headers.cookie.includes('auth_token');
    res.json({ authenticated: hasToken, maintenance: false, discordUser: null });
});


app.listen(PORT, () => {
    console.log(`🚀 Local Server running on http://localhost:${PORT}`);
});
