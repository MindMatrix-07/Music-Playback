import { MusicBrainzClient } from '../../lib/musicbrainz.js';

export const config = {
    runtime: 'edge', // Using Edge runtime for speed if possible, but fetchWithRetry uses Node APIs? Checked lib: uses 'fetch', URL, Map, setTimeout. Should be Edge compatible.
    // However, the user asked for caching. Vercel Edge caching is done via headers.
};

export default async function handler(req) {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'artist' or 'recording'
    const query = searchParams.get('query');

    if (!type || !query) {
        return new Response(JSON.stringify({ error: 'Type and query are required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (!['artist', 'recording'].includes(type)) {
        return new Response(JSON.stringify({ error: 'Invalid type. Use "artist" or "recording".' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const client = new MusicBrainzClient();
        // Construct Lucene query based on type
        // Simple query mapping: just pass the string to the 'query' param
        // MusicBrainz search needs 'query' param.
        const data = await client.fetchWithRetry(`/${type}`, { query });

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' // Cache for 24h
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
