// service-worker.js — network-first with an app-shell cache.
// CACHE_VERSION is bumped on every shipped-file change (CLAUDE.md §13.6).

const CACHE_VERSION = 'reich62-v50';

const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './icon.svg',
  './data.js',
  './data-npcs.js',
  './data-monsters.js',
  './data-journey.js',
  './data-pregens.js',
  './data-solo.js',
  './src/core.js',
  './src/ui.js',
  './src/settings.js',
  './src/rules.js',
  './src/rules-index.js',
  './src/derived.js',
  './src/store.js',
  './src/screens.js',
  './src/wizard.js',
  './src/sheet.js',
  './src/roller.js',
  './src/heat.js',
  './src/clocks.js',
  './src/journey.js',
  './src/combat.js',
  './src/gm.js',
  './src/solo.js',
  './src/help.js',
  './src/router.js',
  './src/update.js',
  './src/main.js'
];

// The new worker deliberately does NOT skip waiting on its own: it stays parked until the
// page tells it to take over, so the app can offer a reload rather than swapping the code
// out from under an open session mid-roll.
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)));
});

// The page asks for the swap once the player has tapped "Reload now".
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html')))
  );
});
