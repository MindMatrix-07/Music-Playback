
// Consolidated Search API (Spotify + Apple Music)
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
        } else {
            return res.status(400).json({ error: 'Invalid platform. Use ?platform=spotify or ?platform=apple' });
        }
    } catch (error) {
        console.error('Search API Error:', error);
        return res.status(500).json({ error: error.message || 'Search failed' });
    }
}

// --- Spotify Logic ---
async function handleSpotifySearch(q, type, limit, res) {
    // Get Token
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
