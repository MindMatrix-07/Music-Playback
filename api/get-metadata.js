// Metadata API - Fetches deep details and cross-platform links
const SPOTIFY_CLIENT_ID = '1cc98da5d08742df809c8b0724725d0b';
// SPOTIFY_CLIENT_SECRET is in process.env

// No import needed

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
            title: null,
            artist: null,
            album: null,
            duration: null, // in ms
            year: null,
            language: null,
            isrc: null,
            genre: [],
            releaseDate: null,
            recordLabel: null,
            bpm: null,
            key: null,
            mode: null,
            popularity: null,
            coverArt: null,
            crossLinks: {
                spotify: null,
                apple: null
            }
        };

        // 1. Get Spotify Access Token (Always required for Audio Features & Search)
        let access_token = null;
        if (process.env.SPOTIFY_CLIENT_SECRET) {
            try {
                const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')
                    },
                    body: 'grant_type=client_credentials'
                });
                if (tokenResponse.ok) {
                    const data = await tokenResponse.json();
                    access_token = data.access_token;
                }
            } catch (e) {
                console.error('Spotify Auth Failed:', e);
            }
        }

        let searchQuery = { title: null, artist: null, isrc: null };
        let spotifyTrackId = null;

        // 2. Fetch Primary Data and Populate Search Query
        if (platform === 'spotify' && access_token) {
            spotifyTrackId = id;
            const trackResp = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
                headers: { 'Authorization': `Bearer ${access_token}` }
            });

            if (trackResp.ok) {
                const track = await trackResp.json();
                metadata.title = track.name;
                metadata.artist = track.artists.map(a => a.name).join(', '); // Primary artist(s)
                metadata.album = track.album?.name;
                metadata.duration = track.duration_ms;
                metadata.isrc = track.external_ids?.isrc;
                metadata.releaseDate = track.album?.release_date;
                metadata.year = metadata.releaseDate ? metadata.releaseDate.split('-')[0] : null;
                metadata.popularity = track.popularity;
                metadata.crossLinks.spotify = track.external_urls?.spotify;
                metadata.coverArt = track.album?.images?.[0]?.url;

                searchQuery.title = track.name;
                searchQuery.artist = track.artists[0]?.name;
                searchQuery.isrc = metadata.isrc;

                // Get Spotify Album details (Genre, Label)
                if (track.album?.id) {
                    const albumResp = await fetch(`https://api.spotify.com/v1/albums/${track.album.id}`, {
                        headers: { 'Authorization': `Bearer ${access_token}` }
                    });
                    if (albumResp.ok) {
                        const album = await albumResp.json();
                        metadata.recordLabel = album.label;
                        metadata.genre = album.genres || [];
                    }
                }
            }

        } else if (platform === 'apple') {
            const appleLookup = await fetch(`https://itunes.apple.com/lookup?id=${id}&country=US`);
            const appleData = await appleLookup.json();

            if (appleData.results?.[0]) {
                const track = appleData.results[0];
                metadata.title = track.trackName;
                metadata.artist = track.artistName;
                metadata.album = track.collectionName;
                metadata.duration = track.trackTimeMillis;
                metadata.crossLinks.apple = track.trackViewUrl;
                metadata.genre = [track.primaryGenreName];
                metadata.releaseDate = track.releaseDate;
                metadata.year = track.releaseDate ? new Date(track.releaseDate).getFullYear().toString() : null;
                metadata.recordLabel = track.collectionCensoredName; // Apple's copyright/label info
                metadata.coverArt = track.artworkUrl100?.replace('100x100', '600x600');
                metadata.language = track.country; // Best approximation for "Language" from standard fields

                searchQuery.title = track.trackName;
                searchQuery.artist = track.artistName;
            }
        }

        // 3. Cross-Reference: Find Missing Platform Link & Data

        // A. If we started with Spotify, search Apple Music
        if (platform === 'spotify' && searchQuery.title) {
            try {
                // Determine clean search term
                const term = `${searchQuery.title} ${searchQuery.artist}`;
                const appleSearch = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=1`);
                const appleResults = await appleSearch.json();

                if (appleResults.results?.[0]) {
                    const match = appleResults.results[0];
                    metadata.crossLinks.apple = match.trackViewUrl;

                    // Merge Metadata - Apple often has better Genre/Label info if Spotify's was generic
                    if (!metadata.recordLabel) metadata.recordLabel = match.collectionCensoredName;
                    if (metadata.genre.length === 0) metadata.genre = [match.primaryGenreName];
                    if (!metadata.releaseDate) {
                        metadata.releaseDate = match.releaseDate;
                        metadata.year = new Date(match.releaseDate).getFullYear().toString();
                    }
                    if (!metadata.coverArt) metadata.coverArt = match.artworkUrl100?.replace('100x100', '600x600');
                    if (!metadata.language) metadata.language = match.country;
                }
            } catch (e) {
                console.error('Apple Music cross-reference failed:', e);
            }
        }

        // B. If we started with Apple, search Spotify (using ISRC if possible, else generic)
        if (platform === 'apple' && access_token) {
            try {
                let query = '';
                if (searchQuery.isrc) { // Apple doesn't easily give ISRC via public lookup, but if we had it... 
                    // Actually, public iTunes Search API DOES NOT return ISRC. So we rely on text search.
                    query = `isrc:${searchQuery.isrc}`;
                } else {
                    query = `track:${searchQuery.title} artist:${searchQuery.artist}`;
                }

                const spotifySearch = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`, {
                    headers: { 'Authorization': `Bearer ${access_token}` }
                });

                if (spotifySearch.ok) {
                    const spotifyData = await spotifySearch.json();
                    if (spotifyData.tracks?.items?.[0]) {
                        const match = spotifyData.tracks.items[0];
                        spotifyTrackId = match.id;
                        metadata.crossLinks.spotify = match.external_urls.spotify;
                        if (!metadata.isrc) metadata.isrc = match.external_ids?.isrc;
                        metadata.popularity = match.popularity;

                        // Merge missing fields
                        if (!metadata.album) metadata.album = match.album?.name;
                        if (!metadata.duration) metadata.duration = match.duration_ms;
                        if (!metadata.coverArt) metadata.coverArt = match.album?.images?.[0]?.url;
                        if (!metadata.releaseDate) {
                            metadata.releaseDate = match.album?.release_date;
                            metadata.year = match.album?.release_date.split('-')[0];
                        }
                    }
                }
            } catch (e) {
                console.error('Spotify cross-reference failed:', e);
            }
        }

        // 4. Audio Features (Requires Spotify Track ID)
        if (spotifyTrackId && access_token) {
            try {
                const featuresResp = await fetch(`https://api.spotify.com/v1/audio-features/${spotifyTrackId}`, {
                    headers: { 'Authorization': `Bearer ${access_token}` }
                });
                if (featuresResp.ok) {
                    const features = await featuresResp.json();
                    if (features) {
                        metadata.bpm = Math.round(features.tempo);
                        const keyMap = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                        const modeMap = ['Minor', 'Major'];
                        if (features.key >= 0) {
                            metadata.key = `${keyMap[features.key]} ${modeMap[features.mode]}`;
                        }
                    }
                }
            } catch (e) {
                console.error('Audio Features fetch failed:', e);
            }
        }

        res.status(200).json(metadata);

    } catch (error) {
        console.error('Metadata fetch critical error:', error);
        res.status(500).json({ error: 'Failed to fetch metadata' });
    }
}
