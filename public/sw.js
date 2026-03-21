const CACHE_NAME = 'dataforge-v1';
const SHELL_CACHE = 'dataforge-shell-v1';
const DATA_CACHE = 'dataforge-data-v1';

// App shell files to cache on install
const SHELL_FILES = [
  '/',
  '/chat',
  '/dashboards',
  '/upload',
  '/connections',
  '/manifest.json',
];

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== DATA_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // API requests: network only (except health and schema which can be cached)
  if (url.pathname.startsWith('/api/')) {
    if (url.pathname === '/api/health' || url.pathname === '/api/schema') {
      event.respondWith(staleWhileRevalidate(event.request, DATA_CACHE, 30 * 60 * 1000));
    }
    return; // Let other API requests go to network
  }

  // Static assets (_next/static): cache first
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(event.request, SHELL_CACHE));
    return;
  }

  // Pages: stale while revalidate
  event.respondWith(staleWhileRevalidate(event.request, SHELL_CACHE, 24 * 60 * 60 * 1000));
});

// Cache strategies
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request, cacheName, maxAge) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      const cache = caches.open(cacheName);
      cache.then((c) => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => cached || new Response('Offline', { status: 503 }));

  return cached || fetchPromise;
}
