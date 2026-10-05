const CACHE_NAME = 'papel-valor-pwa-v1';

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll([
        '/login',
        '/logo-bnc.png',
        '/images/tarjeta-bnc.png'
      ]);
    })
  );
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event (Network first, then fallback to cache)
self.addEventListener('fetch', (event) => {
  // We only handle GET requests
  if (event.request.method !== 'GET') return;
  // Exclude API calls or supabase calls
  if (event.request.url.includes('/api/') || event.request.url.includes('supabase.co')) return;

  event.respondWith(
    fetch(event.request)
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
