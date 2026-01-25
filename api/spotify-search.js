// Spotify Search API - Serverless Function
// Client Secret is stored in Vercel Environment Variables (SPOTIFY_CLIENT_SECRET)

const CLIENT_ID = '1cc98da5d08742df809c8b0724725d0b';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Security Headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    // Security: Referer Check
    const referer = req.headers.referer || req.headers.origin;
    const allowedDomains = ['musicplaybacktool.vercel.app', 'localhost', '127.0.0.1'];
    if (!referer || !allowedDomains.some(d => referer.includes(d))) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const { q, type = 'track', limit = 10 } = req.query;

    if (!q) {
        return res.status(400).json({ error: 'Search query is required' });
    }

    try {
        // Get access token using Client Credentials Flow
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')
            },
            body: 'grant_type=client_credentials'
        });

        if (!tokenResponse.ok) {
            throw new Error('Failed to get Spotify access token');
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Search Spotify
        const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=${type}&limit=${limit}`;

        const searchResponse = await fetch(searchUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!searchResponse.ok) {
            throw new Error('Failed to search Spotify');
        }

        const searchData = await searchResponse.json();

        // Format response
        const tracks = searchData.tracks?.items?.map(track => ({
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

    } catch (error) {
        console.error('Spotify search error:', error);
        return res.status(500).json({ error: error.message || 'Failed to search Spotify' });
    }
}
