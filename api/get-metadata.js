// Metadata API - Fetches deep details and cross-platform links
const SPOTIFY_CLIENT_ID = '1cc98da5d08742df809c8b0724725d0b';
// SPOTIFY_CLIENT_SECRET is in process.env

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const { id, platform } = req.query;
    if (!id || !platform) return res.status(400).json({ error: 'ID and platform are required' });

    try {
        let metadata = {
            title: null,
            artist: null,
            album: null,
            duration: null,
            year: null,
            language: 'International',
            isrc: null,
            genre: [],
            releaseDate: null,
            recordLabel: null,
            coverArt: null,
            artistImages: [],     // New Array { name, url }
            musixmatch: null,
            crossLinks: { spotify: null, apple: null }
        };

        // 1. Spotify Auth
        let access_token = null;
        if (process.env.SPOTIFY_CLIENT_SECRET) {
            try {
                const tokenResp = await fetch('https://accounts.spotify.com/api/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')
                    },
                    body: 'grant_type=client_credentials'
                });
                if (tokenResp.ok) {
                    const data = await tokenResp.json();
                    access_token = data.access_token;
                }
            } catch (e) {
                console.error('Spotify Auth Failed:', e);
            }
        }

        let searchQuery = { title: null, artist: null, isrc: null };

        // 2. Fetch Base Data
        if (platform === 'spotify' && access_token) {
            const trackResp = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
                headers: { 'Authorization': `Bearer ${access_token}` }
            });

            if (trackResp.ok) {
                const track = await trackResp.json();
                metadata.title = track.name;
                metadata.artist = track.artists.map(a => a.name).join(', ');
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
                metadata.recordLabel = track.collectionCensoredName;
                metadata.coverArt = track.artworkUrl100?.replace('100x100', '600x600');
                metadata.language = track.country;

                searchQuery.title = track.trackName;
                searchQuery.artist = track.artistName;
            }
        }

        // 3. Cross-Reference (Spotify <-> Apple)
        if (platform === 'spotify' && searchQuery.title) {
            try {
                const term = `${searchQuery.title} ${searchQuery.artist}`;
                const appleSearch = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=1`);
                const appleResults = await appleSearch.json();
                if (appleResults.results?.[0]) {
                    const match = appleResults.results[0];
                    metadata.crossLinks.apple = match.trackViewUrl;
                    if (!metadata.recordLabel) metadata.recordLabel = match.collectionCensoredName;
                    if (metadata.genre.length === 0) metadata.genre = [match.primaryGenreName];
                    if (!metadata.releaseDate) {
                        metadata.releaseDate = match.releaseDate;
                        metadata.year = new Date(match.releaseDate).getFullYear().toString();
                    }
                }
            } catch (e) { console.error('Apple Search failed', e); }
        }

        if (platform === 'apple' && access_token) {
            try {
                const query = searchQuery.isrc ? `isrc:${searchQuery.isrc}` : `track:${searchQuery.title} artist:${searchQuery.artist}`;
                const spotifySearch = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`, {
                    headers: { 'Authorization': `Bearer ${access_token}` }
                });
                if (spotifySearch.ok) {
                    const data = await spotifySearch.json();
                    if (data.tracks?.items?.[0]) {
                        const match = data.tracks.items[0];
                        metadata.crossLinks.spotify = match.external_urls.spotify;
                        if (!metadata.isrc) metadata.isrc = match.external_ids?.isrc;
                        if (!metadata.album) metadata.album = match.album?.name;
                        if (!metadata.duration) metadata.duration = match.duration_ms;
                        if (!metadata.coverArt) metadata.coverArt = match.album?.images?.[0]?.url;
                        if (!metadata.releaseDate) {
                            metadata.releaseDate = match.album?.release_date;
                            metadata.year = match.album?.release_date.split('-')[0];
                        }
                    }
                }
            } catch (e) { console.error('Spotify Search failed', e); }
        }

        // 4. Wikidata Artist Images (Parallel Fetch for all artists)
        if (metadata.artist) {
            const artists = metadata.artist.split(',').map(s => s.trim());

            // Limit to 4 artists to prevent excessive calls
            const targetArtists = artists.slice(0, 4);

            const imagePromises = targetArtists.map(async (name) => {
                const url = await getWikidataImage(name);
                return { name, url };
            });

            const results = await Promise.all(imagePromises);
            metadata.artistImages = results.filter(item => item.url !== null);
        }

        // 5. Smart Language Detection (Heuristic)
        metadata.language = detectLanguage(metadata.title, metadata.genre, metadata.artist);

        // 6. Musixmatch Link (Google Search)
        if (metadata.title && metadata.artist) {
            const query = `${metadata.title} ${metadata.artist} musixmatch lyrics`;
            metadata.musixmatch = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        }

        res.status(200).json(metadata);

    } catch (error) {
        console.error('Metadata critical error:', error);
        res.status(500).json({ error: 'Failed to fetch metadata' });
    }
}

// Wikidata Helper
async function getWikidataImage(artistName) {
    try {
        // 1. Search for Entity
        const searchResp = await fetch(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(artistName)}&language=en&format=json&limit=1`);
        const searchData = await searchResp.json();

        if (!searchData.search || searchData.search.length === 0) return null;

        const entityId = searchData.search[0].id;

        // 2. Get Claims (P18 = Image)
        const claimResp = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${entityId}&property=P18&format=json`);
        const claimData = await claimResp.json();

        const claims = claimData.claims?.P18;
        if (!claims || claims.length === 0) return null;

        // 3. Construct Image URL from Filename
        const fileName = claims[0].mainsnak.datavalue.value.replace(/ /g, '_');
        // Use Special:FilePath redirect (simplest method)
        return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(fileName)}?width=500`;

    } catch (e) {
        console.error(`Wikidata failed for ${artistName}:`, e);
        return null;
    }
}

// Needed because Wikimedia Special:FilePath is a redirect, handling that in frontend is fine,
// but returning the direct redirect URL is better. 
// Actually Special:FilePath returns the image directly or usage 302. 
// Browsers handle 302 on img src fine.

function detectLanguage(title, genres, artist) {
    if (!title) return 'International';

    const lowerTitle = title.toLowerCase();
    const lowerGenres = genres.map(g => g.toLowerCase());
    const lowerArtist = artist ? artist.toLowerCase() : '';

    if (/[\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uAC00-\uD7AF]/.test(title)) return 'Korean';
    if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(title)) return 'Japanese';
    if (/[\u0400-\u04FF]/.test(title)) return 'Russian';
    if (/[\u0600-\u06FF]/.test(title)) return 'Arabic';
    if (/[\u0900-\u097F]/.test(title)) return 'Hindi';

    const genreString = lowerGenres.join(' ');

    if (genreString.includes('bollywood') || genreString.includes('filmi') ||
        genreString.includes('desi') || genreString.includes('indian')) return 'Hindi';

    if (genreString.includes('punjabi')) return 'Punjabi';
    if (genreString.includes('tamil')) return 'Tamil';

    if (genreString.includes('k-pop') || genreString.includes('korean')) return 'Korean';
    if (genreString.includes('j-pop') || genreString.includes('japanese')) return 'Japanese';
    if (genreString.includes('mandopop') || genreString.includes('chinese')) return 'Chinese';

    if (genreString.includes('latin') || genreString.includes('reggaeton') || genreString.includes('spanish')) return 'Spanish';

    if (lowerArtist.includes('arijit singh') || lowerArtist.includes('atif aslam')) return 'Hindi';
    if (lowerArtist.includes('bts') || lowerArtist.includes('blackpink')) return 'Korean';
    if (lowerArtist.includes('bad bunny')) return 'Spanish';

    return 'International';
}
