const CACHE_NAME = 'music-playback-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json',
    // Add other static assets here if they become local (e.g., icons)
];

// Install Event: Precache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate Event: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event: Stale-While-Revalidate for most things, NetworkFirst for Search
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // 1. API - Search (Network First, fall back to nothing/error - search should be fresh)
    if (url.pathname.includes('/api/search')) {
        event.respondWith(
            fetch(event.request).catch(() => {
                // Return empty or cached if available (optional, but search is usually real-time)
                return new Response(JSON.stringify({ error: 'Offline' }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    // 2. API - Metadata/Lyrics (Stale-While-Revalidate)
    // We want fast load, but update in background
    if (url.pathname.includes('/api/get-metadata') || url.pathname.includes('/api/get-lyrics')) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    const fetchPromise = fetch(event.request).then((networkResponse) => {
                        cache.put(event.request, networkResponse.clone());
                        return networkResponse;
                    });
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    // 3. Images (Cache First)
    // Spotify/Apple/YouTube images don't change often for the same URL
    if (event.request.destination === 'image') {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request).then((networkResponse) => {
                    // Cache opaque responses (like external images) if possible, 
                    // though opaque responses have limitations. 
                    // For performance, we try to cache valid responses.
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        // External images (CORS) might be 'opaque'. 
                        // We can cache them, but we can't read status.
                        // Assuming 'cors' or 'no-cors' requests.
                        // For now, let's cache them if we can.
                    }

                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                    return networkResponse;
                });
            })
        );
        return;
    }

    // 4. Default (Stale-While-Revalidate for HTML/scripts)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                // Update cache
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Configuring explicit offline fallback could go here
            });
            return cachedResponse || fetchPromise;
        })
    );
});
