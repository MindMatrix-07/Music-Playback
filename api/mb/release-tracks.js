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
        // 1. Fetch Release Details
        // includes recordings (tracks), artist-credits
        const release = await client.fetchWithRetry(`/release/${mbid}?inc=recordings+artist-credits`);

        // 2. Fetch Cover Art (separate service, no rate limit usually but good to handle safely)
        let coverArt = null;
        try {
            const coverRes = await fetch(`https://coverartarchive.org/release/${mbid}`);
            if (coverRes.ok) {
                const coverData = await coverRes.json();
                const front = coverData.images.find(img => img.front);
                if (front) {
                    coverArt = {
                        image: front.image,
                        thumbnails: front.thumbnails,
                        // CAA images are public domain or CC-BY, usually safe to link
                        license: "Cover Art Archive"
                    };
                }
            }
        } catch (e) {
            console.log('No cover art found or CAA error');
        }

        // Merge Response
        const responseData = {
            ...release,
            coverArt
        };

        res.status(200).json(client.formatResponse(responseData));

    } catch (error) {
        console.error('Release Tracks API Error:', error);
        res.status(500).json({ error: 'Failed to fetch release tracks' });
    }
}
