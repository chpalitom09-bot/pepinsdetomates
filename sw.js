const CACHE_NAME = 'pepins-v9';
const APP_SHELL = [
  './',
  './index.html',
  './pays.json',
  './lang.json',
  './algo.js',
  './fiche-visuals.js',
  './lists.js',
  './wiki.js',
  './ai.js',
  './countries-shapes.json',
  './auth.html',
  './manifest.json',
  './pepins-icon.svg?v=2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Pages, scripts et traductions : réseau d'abord (toujours à jour), cache en secours hors-ligne.
  // Avant, lang.json restait figé dans le cache -> les nouvelles clés s'affichaient en brut (back_catalog...).
  const url = new URL(req.url);
  const isAppShell = url.origin === self.location.origin;
  const isFresh = isAppShell && (/\.(html|json|js)$/.test(url.pathname) || url.pathname.endsWith('/'));

  if (isFresh) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => caches.match(req))
    );
  } else if (isAppShell) {
    // Icônes, images, vidéo : cache d'abord
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
  } else {
    // Ressources externes (Firebase, CDN, images) : réseau d'abord, repli sur le cache si hors-ligne
    event.respondWith(
      fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone)).catch(() => {});
        return res;
      }).catch(() => caches.match(req))
    );
  }
});
