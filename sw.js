// Poland Tour 통합 Service Worker (모든 도시 공용)
// scope: /poland-tour/
const CACHE_VERSION = 'poland-tour-v12';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './city/',
  './city/index.html',
  './city/warsaw.html',
  './city/krakow.html',
  './city/zakopane.html',
  './city/warsaw/stops-data.js',
  './city/krakow/stops-data.js',
  './city/zakopane/stops-data.js',
  './navi/assets/css/navi.css',
  './navi/assets/js/navi-core.js',
  './navi/assets/js/v3-flex.js',
  './navi/assets/icons/icon-192.png',
  './navi/assets/icons/icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      Promise.all(CORE_ASSETS.map((url) => cache.add(url).catch(() => null)))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.hostname.includes('google.com') || url.hostname.includes('googleapis.com')) return;
  if (url.hostname.includes('tile.openstreetmap')) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION + '-tiles').then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match('./city/')))
    );
    return;
  }
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match('./city/'));
    })
  );
});
