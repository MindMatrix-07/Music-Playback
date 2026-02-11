const cleanTitle = (t) => {
    return t
        .split(/\s*[-|]\s*/)[0] // Remove " - " or " | " or similar
        .replace(/[\(\[](feat|ft|with|prod|remix|version|deluxe|edition|live|mono|stereo|remaster|from).*?[\)\]]/gi, '')
        .trim();
};

const superCleanTitle = (t) => t.split(/\s*[-|]\s*/)[0].replace(/[\(\[].*?[\)\]]/g, '').trim();
const cleanArtist = (a) => a.split(',')[0].trim();

async function test() {
    const title = 'Chiri Thottu | Sarvam Maya';
    const artist = 'Justin Prabhakaran';

    const searchQueries = [
        `${title} ${artist}`,
        `${cleanTitle(title)} ${cleanArtist(artist)}`,
        `${superCleanTitle(title)} ${cleanArtist(artist)}`
    ];

    console.log('Queries:', searchQueries);

    for (const q of searchQueries) {
        console.log(`Testing query: "${q}"`);
        const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`;
        try {
            const resp = await fetch(searchUrl, { headers: { 'User-Agent': 'TestScript/1.0' } });
            const data = await resp.json();
            console.log(`Results for "${q}":`, data.length);
            if (data.length > 0) {
                console.log('First Match:', data[0].name, data[0].artist, 'Has Synced:', !!data[0].syncedLyrics);
            }
        } catch (e) {
            console.error('Error:', e);
        }
    }
}

test();
