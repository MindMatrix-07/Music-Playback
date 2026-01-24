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

    if (!process.env.SPOTIFY_CLIENT_SECRET) {
        console.error('Missing SPOTIFY_CLIENT_SECRET');
        return res.status(500).json({ error: 'Server configuration error: Missing Spotify Secret' });
    }

    try {
        let metadata = {
            isrc: null,
            genre: [],
            releaseDate: null,
            recordLabel: null,
            bpm: null,
            key: null,
            mode: null,
            popularity: null,
            musicBrainzId: null, // Fetched but not displayed
            crossLinks: {
                spotify: null,
                apple: null
            }
        };

        // 1. Get Spotify Token
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

        let spotifyTrackId = null;
        let queryParams = {}; // For fallback search

        if (platform === 'spotify') {
            spotifyTrackId = id;
            // Fetch detailed track info
            const trackResp = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
                headers: { 'Authorization': `Bearer ${access_token}` }
            });
            const track = await trackResp.json();

            metadata.isrc = track.external_ids?.isrc;
            metadata.releaseDate = track.album?.release_date;
            metadata.popularity = track.popularity;
            metadata.crossLinks.spotify = track.external_urls?.spotify;
            queryParams = { title: track.name, artist: track.artists[0]?.name };

            // Fetch Album for Label
            if (track.album?.id) {
                const albumResp = await fetch(`https://api.spotify.com/v1/albums/${track.album.id}`, {
                    headers: { 'Authorization': `Bearer ${access_token}` }
                });
                const album = await albumResp.json();
                metadata.recordLabel = album.label;
                metadata.genre = album.genres && album.genres.length > 0 ? album.genres : [];
            }

            // Fetch Artist for Genres (if album didn't have specific ones)
            if (metadata.genre.length === 0 && track.artists?.[0]?.id) {
                const artistResp = await fetch(`https://api.spotify.com/v1/artists/${track.artists[0].id}`, {
                    headers: { 'Authorization': `Bearer ${access_token}` }
                });
                const artist = await artistResp.json();
                metadata.genre = artist.genres || [];
            }

        } else if (platform === 'apple') {
            // Apple Source
            const appleLookup = await fetch(`https://itunes.apple.com/lookup?id=${id}`);
            const appleData = await appleLookup.json();

            if (appleData.results?.[0]) {
                const track = appleData.results[0];
                metadata.crossLinks.apple = track.trackViewUrl;
                metadata.genre = [track.primaryGenreName];
                metadata.releaseDate = track.releaseDate;
                metadata.recordLabel = track.collectionCensoredName; // Often label info is here or unavailable

                queryParams = { title: track.trackName, artist: track.artistName };

                // Find Spotify details mainly for Audio Features
                const query = `track:${track.trackName} artist:${track.artistName}`;
                const spotifySearch = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`, {
                    headers: { 'Authorization': `Bearer ${access_token}` }
                });
                const spotifyData = await spotifySearch.json();

                if (spotifyData.tracks?.items?.[0]) {
                    const match = spotifyData.tracks.items[0];
                    spotifyTrackId = match.id;
                    metadata.crossLinks.spotify = match.external_urls.spotify;
                    metadata.isrc = match.external_ids?.isrc;
                    metadata.popularity = match.popularity;
                    // Improved label info from Spotify match if Apple didn't give it
                    if (!metadata.recordLabel && match.album?.id) {
                        const albumResp = await fetch(`https://api.spotify.com/v1/albums/${match.album.id}`, {
                            headers: { 'Authorization': `Bearer ${access_token}` }
                        });
                        const album = await albumResp.json();
                        metadata.recordLabel = album.label;
                    }
                }
            }
        }

        // 2. Fetch Audio Features (BPM, Key) - Requires Spotify Track ID
        if (spotifyTrackId) {
            const featuresResp = await fetch(`https://api.spotify.com/v1/audio-features/${spotifyTrackId}`, {
                headers: { 'Authorization': `Bearer ${access_token}` }
            });
            if (featuresResp.ok) {
                const features = await featuresResp.json();
                metadata.bpm = Math.round(features.tempo);

                const keyMap = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                const modeMap = ['Minor', 'Major'];
                if (features.key >= 0) {
                    metadata.key = `${keyMap[features.key]} ${modeMap[features.mode]}`;
                }
            }
        }

        // 3. Smart Link Search (Apple Music)
        if (!metadata.crossLinks.apple && (metadata.isrc || queryParams.title)) {
            // Try ISRC first
            let found = false;
            if (metadata.isrc) {
                const appleSearch = await fetch(`https://itunes.apple.com/search?term=${metadata.isrc}&limit=1`);
                const appleData = await appleSearch.json();
                if (appleData.results?.[0]) {
                    metadata.crossLinks.apple = appleData.results[0].trackViewUrl;
                    found = true;
                }
            }

            // Fallback: Title + Artist search
            if (!found && queryParams.title) {
                const term = `${queryParams.title} ${queryParams.artist}`;
                const appleSearch = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=1`);
                const appleData = await appleSearch.json();
                if (appleData.results?.[0]) {
                    metadata.crossLinks.apple = appleData.results[0].trackViewUrl;
                }
            }
        }

        // 4. Enrich with MusicBrainz (Tags only, ID hidden in frontend)
        if (metadata.isrc) {
            const mbUrl = `https://musicbrainz.org/ws/2/recording?query=isrc:${metadata.isrc}&fmt=json`;
            try {
                const mbResp = await fetch(mbUrl, { headers: { 'User-Agent': 'MusicPlaybackTool/1.0 ( app@example.com )' } });
                if (mbResp.ok) {
                    const mbData = await mbResp.json();
                    if (mbData.recordings?.[0]?.tags) {
                        const tags = mbData.recordings[0].tags.map(t => t.name);
                        // Merge unique tags
                        const uniqueGenres = new Set([...metadata.genre, ...tags]);
                        metadata.genre = Array.from(uniqueGenres);
                    }
                }
            } catch (e) { /* ignore */ }
        }

        res.status(200).json(metadata);

    } catch (error) {
        console.error('Metadata fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch metadata' });
    }
}
