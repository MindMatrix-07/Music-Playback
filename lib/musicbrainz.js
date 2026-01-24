export class MusicBrainzClient {
    constructor() {
        this.baseUrl = 'https://musicbrainz.org/ws/2';
        this.userAgent = 'MissionFinder/1.0 (contact@missionfinder.in)';
        this.cache = new Map(); // Simple in-memory cache for the lifecycle of the instance
    }

    /**
     * Fetch data from MusicBrainz with retry logic, rate limiting respect, and caching.
     * @param {string} endpoint - The API endpoint (e.g., '/recording')
     * @param {object} params - Query parameters
     * @returns {Promise<object>} - The JSON response
     */
    async fetchWithRetry(endpoint, params = {}) {
        const url = new URL(`${this.baseUrl}${endpoint}`);
        params.fmt = 'json'; // Always enforce JSON
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        const cacheKey = url.toString();

        // Check in-memory cache first
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            // Simple expiration check (e.g., 1 hour for in-memory)
            if (Date.now() - cached.timestamp < 3600000) {
                return cached.data;
            }
            this.cache.delete(cacheKey);
        }

        let retries = 3;
        let delay = 1000;

        while (retries > 0) {
            try {
                const response = await fetch(url.toString(), {
                    headers: {
                        'User-Agent': this.userAgent,
                        'Accept': 'application/json'
                    }
                });

                if (response.status === 429 || response.status === 503) {
                    const retryAfter = response.headers.get('Retry-After');
                    const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay;
                    console.log(`Rate limited. Waiting ${waitTime}ms...`);
                    await new Promise(r => setTimeout(r, waitTime));
                    retries--;
                    delay *= 2; // Exponential backoff for next retry
                    continue;
                }

                if (!response.ok) {
                    // Start fresh if 404 to avoid retrying non-existent resources
                    if (response.status === 404) return null;
                    throw new Error(`MusicBrainz API Error: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                const formattedData = this.formatResponse(data);

                // Store in cache
                this.cache.set(cacheKey, {
                    timestamp: Date.now(),
                    data: formattedData
                });

                return formattedData;

            } catch (error) {
                if (retries === 0) throw error;
                console.error(`Fetch failed (${retries} retries left):`, error);
                await new Promise(r => setTimeout(r, delay));
                retries--;
                delay *= 2;
            }
        }
    }

    formatResponse(data) {
        if (!data) return null;
        // Enforce attribution structure
        return {
            ...data,
            _attribution: {
                source: "MusicBrainz",
                license: "CC0 / CC-BY",
                url: "https://musicbrainz.org"
            }
        };
    }

    /**
     * Get Cover Art Archive URL for a release.
     * @param {string} releaseMbid 
     * @returns {string} URL to the front cover image
     */
    getCoverArtUrl(releaseMbid) {
        return `https://coverartarchive.org/release/${releaseMbid}/front`;
    }
}
