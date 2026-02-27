// Consolidated Search API (Spotify + Apple Music + YouTube)
const SPOTIFY_CLIENT_ID = '1cc98da5d08742df809c8b0724725d0b';

// --- Utility: Intelligent Similarity ---
function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    str1 = str1.toLowerCase().trim();
    str2 = str2.toLowerCase().trim();

    if (str1 === str2) return 1;

    // Normalize: remove special chars
    const norm1 = str1.replace(/[^a-z0-9]/g, '');
    const norm2 = str2.replace(/[^a-z0-9]/g, '');

    if (norm1 === norm2) return 0.95;
    if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.8;

    // Phonetic or character overlap
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);

    let matches = 0;
    for (const w1 of words1) {
        if (w1.length < 3) continue;
        for (const w2 of words2) {
            if (w2.includes(w1) || w1.includes(w2)) {
                matches++;
                break;
            }
        }
    }

    if (matches > 0) return 0.5 + (matches / Math.max(words1.length, words2.length)) * 0.4;
    return 0;
}

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
    try {
        // 1. Fetch potential matches (intelligent search)
        // We fetch a list of latest/available tracks and filter them in memory
        // This is efficient for libraries under a few thousand tracks
        const { data: tracks, error } = await supabase
            .from('tracks')
            .select('*')
            .eq('status', 'AVAILABLE')
            .limit(200); // Fetch a healthy window

        if (error) throw error;

        // 2. Apply Fuzzy Similarity
        const fuzzyResults = tracks.map(t => {
            const titleSim = calculateSimilarity(q, t.title);
            const artistSim = calculateSimilarity(q, t.artist || '');
            return { ...t, similarity: Math.max(titleSim, artistSim) };
        })
            .filter(t => t.similarity > 0.45) // Threshold for "intelligent" match
            .sort((a, b) => b.similarity - a.similarity);

        // 3. If results found, return them
        if (fuzzyResults.length > 0) {
            console.log(`[Intelligent Match] Found ${fuzzyResults.length} tracks for "${q}"`);

            // Spotify Auth for Enrichment
            let spotify_access_token = null;
            try {
                spotify_access_token = await getSpotifyAccessToken();
            } catch (e) {
                console.error('Spotify Auth (Enrichment) Failed:', e);
            }

            const results = await Promise.all(fuzzyResults.slice(0, limit).map(async (t, index) => {
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
