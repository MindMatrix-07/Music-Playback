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
        // Fetch Recording with:
        // - artist-credits (performers)
        // - work-rels (composers, lyricists linked via work)
        // - artist-rels (direct artist relationships like producer)
        const data = await client.fetchWithRetry(`/recording/${mbid}?inc=artist-credits+work-rels+artist-rels`);
        res.status(200).json(data);
    } catch (error) {
        console.error('Recording Credits API Error:', error);
        res.status(500).json({ error: 'Failed to fetch credits' });
    }
}
