import express from 'express';
import cors from 'cors';

// Import Handlers
import verifyAccessHandler from './verify-access.js';
import searchHandler from './search.js';
import getMetadataHandler from './get-metadata.js';
import getLyricsHandler from './get-lyrics.js';
import spotifyLoginHandler from './spotify-login.js';
import spotifyCallbackHandler from './spotify-callback.js';
import generateCodeHandler from './generate-code.js';
import adminHandler from './admin/handler.js';
import analyticsHandler from './analytics/track.js';
import authStatusHandler from './auth/status.js';
import discordHandler from './auth/discord.js';
import discordCallbackHandler from './auth/callback/discord.js';
import userHandler from './auth/user.js';


const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Adapter for Sync/Async Handlers to Express 
const adapter = (handler) => async (req, res) => {
    try {
        await handler(req, res);
    } catch (e) {
        console.error(e);
        if (!res.headersSent) res.status(500).json({ error: e.message });
    }
};

// --- Routes ---
app.all('/api/verify-access', adapter(verifyAccessHandler));
app.get('/api/search', adapter(searchHandler));
app.get('/api/get-metadata', adapter(getMetadataHandler));
app.get('/api/get-lyrics', adapter(getLyricsHandler));

// Auth
app.get('/api/spotify-login', adapter(spotifyLoginHandler));
app.get('/api/spotify-callback', adapter(spotifyCallbackHandler));
app.get('/api/auth/status', adapter(authStatusHandler));
app.get('/api/auth/discord', adapter(discordHandler));
app.get('/api/auth/callback/discord', adapter(discordCallbackHandler));
app.delete('/api/auth/user', adapter(userHandler));

// Admin / Gen Code
app.post('/api/generate-code', adapter(generateCodeHandler));
app.all('/api/admin/handler', adapter(adminHandler)); // Admin dashboard data

// Analytics
app.post('/api/analytics/track', adapter(analyticsHandler));


export default app;
