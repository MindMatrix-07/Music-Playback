import { MusicBrainzClient } from '../../lib/musicbrainz.js';

export const config = {
    runtime: 'edge'
};

export default async function handler(req) {
    const { searchParams } = new URL(req.url);
    const mbid = searchParams.get('mbid');

    if (!mbid) {
        return new Response(JSON.stringify({ error: 'Artist MBID is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const client = new MusicBrainzClient();
        const data = await client.fetchWithRetry('/release-group', {
            artist: mbid,
            type: 'album|single', // Filter slightly to relevant types
            limit: 20 // Reasonable limit
        });

        // Add cover art place holders or lookups if needed, but for now just raw data + attribution
        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600'
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
