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
        // Strategy: 
        // 1. Try exact search (Title + Artist)
        // 2. If that fails, try sanitizing title (remove (feat. X), [Remix], etc)
        // 3. Fallback to just Title if Artist search is too specific (risky but useful)

        // Improved Sanitize Function
        const cleanTitle = (t) => {
            return t
                .split(/ - | \| /)[0] // Remove " - Remastered" OR " | Movie Name"
                .replace(/[\(\[](feat|ft|with|prod|remix|version|deluxe|edition|live|mono|stereo|remaster|from).*?[\)\]]/gi, '')
                .trim();
        };

        // Fallback: Remove ALL text in brackets AND after separators
        const superCleanTitle = (t) => t.split(/ - | \| /)[0].replace(/[\(\[].*?[\)\]]/g, '').trim();

        const cleanArtist = (a) => a.split(',')[0].trim(); // Take first artist only

        let searchQueries = [
            `${title} ${artist}`,
            `${cleanTitle(title)} ${cleanArtist(artist)}`,
            `${superCleanTitle(title)} ${cleanArtist(artist)}`
        ];

        // Remove duplicates
        searchQueries = [...new Set(searchQueries)];

        let match = null;

        for (const q of searchQueries) {
            if (match) break; // Found? Stop.

            try {
                const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`;
                const searchResp = await fetch(searchUrl, {
                    headers: { 'User-Agent': 'MusicPlaybackApp/1.0 (Educational Project)' }
                });

                if (searchResp.ok) {
                    const data = await searchResp.json();
                    if (Array.isArray(data) && data.length > 0) {
                        // Duration Check (if provided)
                        if (duration) {
                            const durSec = parseInt(duration) / 1000;
                            // Tolerance: 15 seconds (some radio edits differ)
                            match = data.find(item => Math.abs(item.duration - durSec) < 15);
                        }

                        // If no duration match (or no duration provided), take the first result
                        if (!match) match = data[0];
                    }
                }
            } catch (e) {
                console.warn(`Lyrics search failed for query: ${q}`, e);
            }
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
