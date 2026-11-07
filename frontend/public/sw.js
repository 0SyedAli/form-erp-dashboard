// Foam Shop POS — Service Worker for Full Offline Resilience
const CACHE_NAME = 'foam-shop-pos-v2';

const STATIC_PRECACHE = [
  '/',
  '/pos',
  '/pos/history',
  '/manifest.json',
  '/favicon.ico',
];

// 1. Install Event: Cache essential app shell routes
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        STATIC_PRECACHE.map((url) =>
          fetch(url, { cache: 'no-cache' })
            .then((res) => {
              if (res.ok) return cache.put(url, res);
            })
            .catch(() => {
              // Ignore precache failures for dynamic/session-gated paths
            })
        )
      );
    })
  );
});

// 2. Activate Event: Clean old caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Intercept requests to provide offline fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-GET requests (mutations handled by IndexedDB queue)
  if (request.method !== 'GET') return;

  // Ignore non-http schemes
  if (!url.protocol.startsWith('http')) return;

  // Let backend API data calls pass through (managed by RTK Query / IndexedDB)
  if (url.pathname.startsWith('/api/')) return;

  // Ignore WebSockets / HMR development connections
  if (url.pathname.includes('/_next/webpack-hmr') || url.pathname.includes('/_next/hmr')) return;

  // A. Navigation Requests (User pressing F5, refresh, or clicking link)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          // INTERNET IS DISCONNECTED / LIGHT IS GONE: Return cached HTML!
          const cached = await caches.match(request, { ignoreSearch: true });
          if (cached) return cached;

          // Try matching pathname directly
          const pathnameMatch = await caches.match(url.pathname, { ignoreSearch: true });
          if (pathnameMatch) return pathnameMatch;

          // POS route fallback
          if (url.pathname.startsWith('/pos')) {
            const posFallback = await caches.match('/pos', { ignoreSearch: true });
            if (posFallback) return posFallback;
          }

          // General root fallback
          const rootFallback = await caches.match('/', { ignoreSearch: true });
          if (rootFallback) return rootFallback;

          return new Response(
            `<!DOCTYPE html>
            <html lang="en">
              <head>
                <meta charset="utf-8" />
                <title>Foam Shop POS — Offline</title>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <style>
                  body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; text-align: center; }
                  .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 400px; }
                  h1 { font-size: 1.25rem; color: #0f172a; margin-bottom: 0.5rem; }
                  p { font-size: 0.875rem; color: #64748b; margin-bottom: 1.5rem; }
                  a { display: inline-block; background: #0f9d58; color: white; padding: 0.625rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: bold; font-size: 0.875rem; }
                </style>
              </head>
              <body>
                <div class="card">
                  <h1>Offline Mode</h1>
                  <p>Internet connection is currently unavailable.</p>
                  <a href="/pos">Go to POS</a>
                </div>
              </body>
            </html>`,
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // B. Static & Script Assets (_next/static, css, js, fonts, images)
  // Stale-While-Revalidate with ignoreSearch for Next.js chunks
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          return cachedResponse;
        });

      return cachedResponse || fetchPromise;
    })
  );
});
