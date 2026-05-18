// Service Worker — 오프라인 캐시 (Cache-First, network-fallback)
const CACHE_VERSION = 'warsaw-tour-v5';
const CORE_ASSETS = [
  './',
  './index.html',
  './v1-leaflet.html',
  './v2-embed.html',
  './v3-flex.html',
  './manifest.json',
  './stops-data.js',
  '../navi/assets/css/navi.css',
  '../navi/assets/js/navi-core.js',
  '../navi/assets/js/v1-leaflet.js',
  '../navi/assets/js/v3-flex.js',
  '../navi/assets/icons/icon-192.png',
  '../navi/assets/icons/icon-512.png',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      // 일부 리소스(타사 CDN)는 실패 가능 — 개별 add로 무시
      return Promise.all(
        CORE_ASSETS.map((url) => cache.add(url).catch(() => null))
      );
    })
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
  // 구글 지도 임베드/타일은 네트워크만
  if (url.hostname.includes('google.com') || url.hostname.includes('googleapis.com')) return;
  if (url.hostname.includes('tile.openstreetmap')) {
    // 지도 타일은 cache-first, fallback to network
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION + '-tiles').then((c) => c.put(req, copy));
        return res;
      }).catch(() => caches.match('./index.html')))
    );
    return;
  }
  // 그 외: cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
