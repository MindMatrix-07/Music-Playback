export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // Security Headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    // Security: Referer Check
    const referer = req.headers.referer || req.headers.origin;
    if (!referer || (!referer.includes('musicplaybacktool.vercel.app') && !referer.includes('localhost'))) {
        return res.status(403).json({ error: 'Unauthorized' });
    }

    const { title, artist, album, duration } = req.query;

    if (!title || !artist) {
        return res.status(400).json({ error: 'Title and Artist are required' });
    }

    try {
        // Strategy: Search for the track on LRCLIB
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(title + ' ' + artist)}`;

        const searchResp = await fetch(searchUrl, {
            headers: { 'User-Agent': 'MusicPlaybackApp/1.0 (Educational Project)' }
        });

        if (!searchResp.ok) {
            throw new Error('LRCLIB Search failed');
        }

        const data = await searchResp.json();

        // Find best match
        let match = null;
        if (Array.isArray(data) && data.length > 0) {
            // Pick first match by default as search is ranked
            // Optional: refine by duration if needed
            if (duration) {
                const durSec = parseInt(duration) / 1000;
                match = data.find(item => Math.abs(item.duration - durSec) < 10); // 10s tolerance
            }
            if (!match) match = data[0];
        }

        if (match) {
            return res.status(200).json({
                plainLyrics: match.plainLyrics,
                syncedLyrics: match.syncedLyrics,
                source: 'LRCLIB'
            });
        }

        return res.status(404).json({ error: 'Lyrics not found' });

    } catch (error) {
        console.error('Lyrics fetch error:', error);
        return res.status(500).json({ error: 'Failed to fetch lyrics' });
    }
}
