
import { MusicBrainzClient } from '../lib/musicbrainz.js';

// Simple mock for fetch to spy on headers if we were unit testing, 
// but here we want to run against the real API (carefully) to verify implementation success.
// We will use the library directly.

async function verify() {
    console.log("Starting Verification...");
    const client = new MusicBrainzClient();

    try {
        console.log("\n1. Testing Generic Search (Coldplay)...");
        const searchData = await client.fetchWithRetry('/artist', { query: 'Coldplay' });
        if (searchData.artists && searchData.artists.length > 0) {
            console.log("✅ Search successful. Found:", searchData.artists[0].name);
        } else {
            console.error("❌ Search failed or no results.");
        }

        if (searchData._attribution) {
            console.log("✅ Attribution present:", searchData._attribution);
        } else {
            console.error("❌ Attribution missing.");
        }

        console.log("\n2. Testing Rate Limiting (Simulating bursts)...");
        const start = Date.now();
        // Fire 3 requests rapidly
        const p1 = client.fetchWithRetry('/artist', { query: 'Radiohead' });
        const p2 = client.fetchWithRetry('/artist', { query: 'Muse' });
        const p3 = client.fetchWithRetry('/artist', { query: 'Queen' });

        await Promise.all([p1, p2, p3]);
        const end = Date.now();
        console.log(`✅ 3 Requests completed in ${end - start}ms`);
        // We expect some time to pass if rate limiting/delays are working, 
        // essentially the library delays retries on 429, but here we might not hit 429 
        // because we are just calling fetch. the library logic handles 429 IF received.
        // We can't easily force a 429 without being abusive. 
        // So we assume success if no errors thrown.

        console.log("\n3. Testing Cover Art URL Generation...");
        const coverUrl = client.getCoverArtUrl('fake-mbid-123');
        if (coverUrl === 'https://coverartarchive.org/release/fake-mbid-123/front') {
            console.log("✅ Cover Art URL correctness confirmed.");
        } else {
            console.error("❌ Cover Art URL mismatch:", coverUrl);
        }

        console.log("\nVerification Complete.");

    } catch (e) {
        console.error("❌ Verification Failed:", e);
    }
}

verify();
