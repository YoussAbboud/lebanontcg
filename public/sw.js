/* LebanonTCG service worker.
 *
 * Exists so the site installs as an app from the home screen and opens to
 * something when the phone is offline. It stays out of the way of the data:
 * only same-origin GETs are handled, pages always go to the network (so a
 * deploy is picked up on the next open and version.json is never stale),
 * Vite's hashed /assets/ files are cached because they never change, and
 * everything else — /api/, Supabase, tiles — is left to the browser.
 */
const CACHE = 'ltcg-v1';
const OFFLINE = '/offline.html';
const PRECACHE = [OFFLINE, '/icon-192.png', '/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Pages: the network, and the offline page only when it can't be reached.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }

  // Immutable build output: serve from the cache, fill it from the network.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // The precached icons, so the offline page has its logo.
  if (PRECACHE.includes(url.pathname)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});
