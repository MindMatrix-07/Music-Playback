import fs from 'fs';

const path = 'index.html';

try {
    let content = fs.readFileSync(path, 'utf8');

    // Add search debouncing logic
    const debounceJS = `
        let searchTimeout;
        function setupSearchDebounce() {
            const input = document.getElementById('searchInput');
            if (!input) return;
            
            input.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                const query = e.target.value.trim();
                
                // Only search if 3+ characters or if it was cleared
                if (query.length >= 3 || query.length === 0) {
                    searchTimeout = setTimeout(() => {
                        searchMusic();
                    }, 500); // 500ms debounce
                }
            });
        }
    `;

    // Insert before searchMusic
    content = content.replace('async function searchMusic() {', debounceJS + '\n\n        async function searchMusic() {');

    // Call in DOMContentLoaded
    content = content.replace('ui.init();', 'ui.init();\n            setupSearchDebounce();');

    fs.writeFileSync(path, content);
    console.log('Search debouncing added.');
} catch (err) {
    console.error('Error:', err);
    process.exit(1);
}
