import { MusicBrainzClient } from '../../lib/musicbrainz.js';

export default async function handler(req, res) {
    const { type, q } = req.query;

    if (!q || !type) {
        return res.status(400).json({ error: 'Missing query (q) or type' });
    }

    if (!['recording', 'artist'].includes(type)) {
        return res.status(400).json({ error: 'Invalid type. Use "recording" or "artist"' });
    }

    const client = new MusicBrainzClient();
    const query = encodeURIComponent(q);

    // Cache for 24 hours
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');

    try {
        const data = await client.fetchWithRetry(`/${type}?query=${query}&limit=10`);
        res.status(200).json(data);
    } catch (error) {
        console.error('Search API Error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
}
