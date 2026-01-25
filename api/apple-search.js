// Apple Music Search API - Serverless Function
// Uses iTunes Search API (no authentication required for search)

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

    const { q, limit = 10, country = 'us' } = req.query;

    if (!q) {
        return res.status(400).json({ error: 'Search query is required' });
    }

    try {
        // Use iTunes Search API (free, no auth required)
        const searchUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=${limit}&country=${country}`;

        const searchResponse = await fetch(searchUrl);

        if (!searchResponse.ok) {
            throw new Error('Failed to search Apple Music');
        }

        const searchData = await searchResponse.json();

        // Format response
        const tracks = searchData.results?.map(track => ({
            id: track.trackId,
            name: track.trackName,
            artist: track.artistName,
            album: track.collectionName,
            image: track.artworkUrl100?.replace('100x100', '300x300') || '',
            duration: track.trackTimeMillis,
            previewUrl: track.previewUrl,
            appleUrl: track.trackViewUrl,
            // Apple Music embed format
            embedUrl: `https://embed.music.apple.com/${country}/song/${track.trackId}`
        })) || [];

        return res.status(200).json({ tracks });

    } catch (error) {
        console.error('Apple Music search error:', error);
        return res.status(500).json({ error: error.message || 'Failed to search Apple Music' });
    }
}
