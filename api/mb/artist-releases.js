import { MusicBrainzClient } from '../../lib/musicbrainz.js';

export default async function handler(req, res) {
    const { mbid } = req.query;

    if (!mbid) {
        return res.status(400).json({ error: 'Missing MBID' });
    }

    const client = new MusicBrainzClient();

    // Cache for 24 hours
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');

    try {
        // Fetch release groups (Albums, Singles, EPs)
        const data = await client.fetchWithRetry(`/release-group?artist=${mbid}&type=album|single|ep&limit=50`);
        res.status(200).json(data);
    } catch (error) {
        console.error('Artist Releases API Error:', error);
        res.status(500).json({ error: 'Failed to fetch releases' });
    }
}
