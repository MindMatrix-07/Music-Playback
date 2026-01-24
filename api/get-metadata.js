// Metadata API - Fetches deep details and cross-platform links
const SPOTIFY_CLIENT_ID = '1cc98da5d08742df809c8b0724725d0b';
// SPOTIFY_CLIENT_SECRET is in process.env

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id, platform } = req.query;

    if (!id || !platform) {
        return res.status(400).json({ error: 'ID and platform are required' });
    }

    try {
        let metadata = {
            isrc: null,
            genre: [],
            releaseDate: null,
            recordLabel: null,
            crossLinks: {
                spotify: null,
                apple: null
            }
        };

        // 1. Get Spotify Token (needed for both paths)
        const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')
            },
            body: 'grant_type=client_credentials'
        });

        if (!tokenResponse.ok) throw new Error('Spotify Auth Failed');
        const { access_token } = await tokenResponse.json();

        if (platform === 'spotify') {
            // A. Source is Spotify
            // 1. Fetch Track Details (ISRC, Artist ID)
            const trackResp = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
                headers: { 'Authorization': `Bearer ${access_token}` }
            });
            const track = await trackResp.json();

            metadata.isrc = track.external_ids?.isrc;
            metadata.releaseDate = track.album?.release_date;
            metadata.crossLinks.spotify = track.external_urls?.spotify;

            // 2. Fetch Artist for Genres
            if (track.artists?.[0]?.id) {
                const artistResp = await fetch(`https://api.spotify.com/v1/artists/${track.artists[0].id}`, {
                    headers: { 'Authorization': `Bearer ${access_token}` }
                });
                const artist = await artistResp.json();
                metadata.genre = artist.genres || [];
            }

            // 3. Find Apple Music Match via ISRC
            if (metadata.isrc) {
                const appleSearch = await fetch(`https://itunes.apple.com/search?term=${metadata.isrc}&limit=1`);
                const appleData = await appleSearch.json();
                if (appleData.results?.[0]) {
                    metadata.crossLinks.apple = appleData.results[0].trackViewUrl;
                    if (!metadata.genre.length) {
                        metadata.genre = [appleData.results[0].primaryGenreName];
                    }
                    metadata.recordLabel = appleData.results[0].collectionCensoredName; // Approximate
                }
            }

        } else if (platform === 'apple') {
            // B. Source is Apple Music (iTunes)
            // 1. Lookup Track in iTunes
            // Apple IDs are numeric, usually passed as is.
            const appleLookup = await fetch(`https://itunes.apple.com/lookup?id=${id}`);
            const appleData = await appleLookup.json();

            if (appleData.results?.[0]) {
                const track = appleData.results[0];
                metadata.crossLinks.apple = track.trackViewUrl;
                metadata.genre = [track.primaryGenreName];
                metadata.releaseDate = track.releaseDate;

                // Note: iTunes public API doesn't always strictly return ISRC on the lookup endpoint for all regions/files,
                // but usually it does. If not, we iterate.
                // Actually, iTunes Lookup often DOES NOT return ISRC publicly reliably.
                // We might have to search by title/artist on Spotify if ISRC is missing.

                // Let's try to search Spotify by Title + Artist as a fallback or primary match
                const query = `track:${track.trackName} artist:${track.artistName}`;
                const spotifySearch = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`, {
                    headers: { 'Authorization': `Bearer ${access_token}` }
                });
                const spotifyData = await spotifySearch.json();

                if (spotifyData.tracks?.items?.[0]) {
                    const match = spotifyData.tracks.items[0];
                    metadata.crossLinks.spotify = match.external_urls.spotify;
                    metadata.isrc = match.external_ids?.isrc; // Get ISRC from Spotify match
                }
            }
        }

        // 4. Enrich with MusicBrainz (if ISRC exists)
        if (metadata.isrc) {
            try {
                // MusicBrainz requires a User-Agent
                const mbUrl = `https://musicbrainz.org/ws/2/recording?query=isrc:${metadata.isrc}&fmt=json`;
                const mbResp = await fetch(mbUrl, {
                    headers: { 'User-Agent': 'MusicPlaybackTool/1.0 ( your@email.com )' }
                });

                if (mbResp.ok) {
                    const mbData = await mbResp.json();
                    if (mbData.count > 0 && mbData.recordings?.[0]) {
                        const rec = mbData.recordings[0];
                        metadata.musicBrainzId = rec.id;
                        // Merge tags if we don't have genres
                        if ((!metadata.genre || metadata.genre.length === 0) && rec.tags) {
                            metadata.genre = rec.tags.map(t => t.name);
                        }
                    }
                }
            } catch (err) {
                console.error('MusicBrainz fetch failed:', err);
            }
        }

        res.status(200).json(metadata);

    } catch (error) {
        console.error('Metadata fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch metadata' });
    }
}
