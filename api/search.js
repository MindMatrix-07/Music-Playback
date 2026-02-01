
// Consolidated Search API (Spotify + Apple Music)
// Consolidated Search API (Spotify + Apple Music)
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

// Consolidated Search API (Spotify + Apple Music + YouTube)
const SPOTIFY_CLIENT_ID = '1cc98da5d08742df809c8b0724725d0b';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // Security Headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    // Referer Check
    const referer = req.headers.referer || req.headers.origin;
    const allowedDomains = ['musicplaybacktool.vercel.app', 'localhost', '127.0.0.1'];
    if (!referer || !allowedDomains.some(d => referer.includes(d))) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const { platform, q, limit = 10, type = 'track', country = 'us' } = req.query;

    if (!q) return res.status(400).json({ error: 'Search query is required' });

    try {
        if (platform === 'spotify') {
            return await handleSpotifySearch(q, type, limit, res);
        } else if (platform === 'apple') {
            return await handleAppleSearch(q, limit, country, res);
        } else if (platform === 'youtube') {
            return await handleYouTubeSearch(req, q, limit, res);
        } else {
            return res.status(400).json({ error: 'Invalid platform. Use ?platform=spotify, ?platform=apple, or ?platform=youtube' });
        }
    } catch (error) {
        console.error('Search API Error:', error);
        return res.status(500).json({ error: error.message || 'Search failed' });
    }
}

// --- Spotify Auth Helper ---
async function getSpotifyAccessToken() {
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')
        },
        body: 'grant_type=client_credentials'
    });

    if (!tokenResponse.ok) throw new Error('Failed to get Spotify access token');
    const { access_token } = await tokenResponse.json();
    return access_token;
}

// --- Spotify Logic ---
async function handleSpotifySearch(q, type, limit, res) {
    // Get Token
    const access_token = await getSpotifyAccessToken();

    // Search
    const searchRes = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=${type}&limit=${limit}`, {
        headers: { 'Authorization': `Bearer ${access_token}` }
    });

    if (!searchRes.ok) throw new Error('Failed to search Spotify');
    const data = await searchRes.json();

    const tracks = data.tracks?.items?.map(track => ({
        id: track.id,
        name: track.name,
        artist: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        image: track.album.images[0]?.url || '',
        duration: track.duration_ms,
        previewUrl: track.preview_url,
        spotifyUrl: track.external_urls.spotify,
        embedUrl: `https://open.spotify.com/embed/track/${track.id}?utm_source=generator&theme=0`
    })) || [];

    return res.status(200).json({ tracks });
}

// --- Apple Logic ---
async function handleAppleSearch(q, limit, country, res) {
    const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=${limit}&country=${country}`;
    const searchRes = await fetch(searchUrl);

    if (!searchRes.ok) throw new Error('Failed to search Apple Music');
    const data = await searchRes.json();

    const tracks = data.results?.map(track => ({
        id: track.trackId,
        name: track.trackName,
        artist: track.artistName,
        album: track.collectionName,
        image: track.artworkUrl100?.replace('100x100', '300x300') || '',
        duration: track.trackTimeMillis,
        previewUrl: track.previewUrl,
        appleUrl: track.trackViewUrl,
        embedUrl: `https://embed.music.apple.com/${country}/song/${track.trackId}`
    })) || [];

    return res.status(200).json({ tracks });
}

// --- YouTube Logic ---
// --- System 2.0 Logic (Supabase) ---
import { supabase } from './_utils/supabase.js';

async function handleYouTubeSearch(req, q, limit, res) {
    console.log(`[System 2.0] Search: "${q}"`);

    try {
        // 1. Check if track exists in DB
        // Using textSearch for basic fuzzy matching, or ilike
        const { data: tracks, error } = await supabase
            .from('tracks')
            .select('*')
            .ilike('title', `%${q}%`)
            .eq('status', 'AVAILABLE')
            .limit(limit);

        if (error) throw error;

        // 2. If results found, return them
        if (tracks && tracks.length > 0) {
            console.log(`[Cache Hit] Found ${tracks.length} tracks for "${q}"`);

            // Spotify Auth for Enrichment
            let spotify_access_token = null;
            try {
                spotify_access_token = await getSpotifyAccessToken();
            } catch (e) {
                console.error('Spotify Auth (Enrichment) Failed:', e);
            }

            const results = await Promise.all(tracks.map(async (t, index) => {
                let metadata = {
                    name: t.title,
                    artist: t.artist,
                    image: t.playback_metadata?.thumbnail || '',
                    duration: t.playback_metadata?.duration || 0
                };

                // Enrichment: Search Spotify for better metadata (only for top few results to keep it fast)
                if (index < 3 && spotify_access_token) {
                    try {
                        const term = `${t.title} ${t.artist}`;
                        const spotRes = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(term)}&type=track&limit=1`, {
                            headers: { 'Authorization': `Bearer ${spotify_access_token}` }
                        });
                        const spotData = await spotRes.json();
                        if (spotData.tracks?.items?.[0]) {
                            const match = spotData.tracks.items[0];
                            metadata.name = match.name;
                            metadata.artist = match.artists.map(a => a.name).join(', ');
                            metadata.image = match.album.images[0]?.url || metadata.image;
                            metadata.duration = match.duration_ms;
                            metadata.spotifyUrl = match.external_urls.spotify;
                        }
                    } catch (e) { console.error('Spotify Enrichment failed', e); }
                }

                return {
                    id: t.id,
                    name: metadata.name,
                    artist: metadata.artist,
                    image: metadata.image,
                    duration: metadata.duration,
                    youtubeId: t.playback_metadata?.youtube_id,
                    embedUrl: `https://www.youtube.com/embed/${t.playback_metadata?.youtube_id}`,
                    youtubeUrl: `https://www.youtube.com/watch?v=${t.playback_metadata?.youtube_id}`,
                    spotifyUrl: metadata.spotifyUrl,
                    systemStatus: 'AVAILABLE'
                };
            }));

            return res.status(200).json({ tracks: results });
        }

        // 3. If NOT found, Queue it
        console.log(`[Cache Miss] Queuing "${q}"`);

        // Check if already queued to avoid duplicates
        const { data: existing } = await supabase
            .from('request_queue')
            .select('id')
            .ilike('query', q) // Case-insensitive check
            .maybeSingle();

        if (!existing) {
            await supabase
                .from('request_queue')
                .insert([{ query: q, priority: 1 }]);
        }

        // Return a "Pending" response so UI can show "Collecting..."
        return res.status(200).json({
            tracks: [],
            systemStatus: 'QUEUED',
            message: 'Track not found. Added to collection queue. Please try again in 1-2 minutes.'
        });

    } catch (err) {
        console.error('System 2.0 Error:', err);
        return res.status(500).json({ error: 'Database connection failed' });
    }
}
