export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { title, artist, album, duration } = req.query;

    if (!title || !artist) {
        return res.status(400).json({ error: 'Title and Artist are required' });
    }

    try {
        // Strategy 1: Search for the track
        // LRCLIB search is powerful. We encode params.
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
            // Simple filtering: ensure artist match is close
            // For now, just pick the first one as search is usually good
            // Or try to match duration if provided
            if (duration) {
                const durSec = parseInt(duration) / 1000;
                // Find closest duration match within 5 seconds
                match = data.find(item => Math.abs(item.duration - durSec) < 5);
            }

            // Fallback to first item if no duration match
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
