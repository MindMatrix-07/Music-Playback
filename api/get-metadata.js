// Metadata API - Fetches deep details and cross-platform links
const SPOTIFY_CLIENT_ID = '1cc98da5d08742df809c8b0724725d0b';
// SPOTIFY_CLIENT_SECRET is in process.env

import { MusicBrainzClient } from '../lib/musicbrainz.js';

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
            bpm: null,
            key: null,
            mode: null,
            popularity: null,
            musicBrainzId: null,
            crossLinks: {
                spotify: null,
                apple: null
            }
        };

        // 1. Try Spotify Auth (Graceful Fallback)
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

        let spotifyTrackId = null;
        let queryParams = {};

        // 2. Fetch Base Object
        if (platform === 'spotify' && access_token) {
            spotifyTrackId = id;
            const trackResp = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
                headers: { 'Authorization': `Bearer ${access_token}` }
            });

            if (trackResp.ok) {
                const track = await trackResp.json();
                metadata.isrc = track.external_ids?.isrc;
                metadata.releaseDate = track.album?.release_date;
                metadata.popularity = track.popularity;
                metadata.crossLinks.spotify = track.external_urls?.spotify;
                queryParams = { title: track.name, artist: track.artists[0]?.name };

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
            const appleLookup = await fetch(`https://itunes.apple.com/lookup?id=${id}`);
            const appleData = await appleLookup.json();

            if (appleData.results?.[0]) {
                const track = appleData.results[0];
                metadata.crossLinks.apple = track.trackViewUrl;
                metadata.genre = [track.primaryGenreName];
                metadata.releaseDate = track.releaseDate;
                metadata.recordLabel = track.collectionCensoredName;
                queryParams = { title: track.trackName, artist: track.artistName };

                // Try to find Spotify equivalent if token exists
                if (access_token) {
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
                    }
                }
            }
        }

        // 3. Audio Features (Only if we have Spotify ID & Token)
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

        // 4. MusicBrainz Enrichment (Using new robust client)
        if (metadata.isrc) {
            try {
                const mbClient = new MusicBrainzClient();
                // We use fetchWithRetry from the library
                const mbData = await mbClient.fetchWithRetry(`/recording?query=isrc:${metadata.isrc}&limit=1`);

                if (mbData.recordings?.[0]?.tags) {
                    const tags = mbData.recordings[0].tags.map(t => t.name);
                    const uniqueGenres = new Set([...metadata.genre, ...tags]);
                    metadata.genre = Array.from(uniqueGenres);
                }
            } catch (e) {
                console.error('MusicBrainz fetch failed:', e);
            }
        }

        res.status(200).json(metadata);

    } catch (error) {
        console.error('Metadata fetch critical error:', error);
        // Even on critical error, return what we have or empty 200 to avoid "Error loading" hanging if possible, or 500 if total fail
        res.status(500).json({ error: 'Failed to fetch metadata' });
    }
}
