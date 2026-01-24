export class MusicBrainzClient {
    constructor() {
        this.baseUrl = 'https://musicbrainz.org/ws/2';
        this.userAgent = 'MyPublicMusicSite/1.0 (contact@mydomain.com)';
    }

    async fetchWithRetry(endpoint, params = {}) {
        const url = new URL(`${this.baseUrl}${endpoint}`);
        params.fmt = 'json'; // Always enforce JSON
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

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
                    delay *= 2; // Exponential backoff
                    continue;
                }

                if (!response.ok) {
                    throw new Error(`MusicBrainz API Error: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();
                return this.formatResponse(data);

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
}
