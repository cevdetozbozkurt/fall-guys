const VERSION = "tumble-club-37f152545364";
const PRECACHE = ["./","./manifest.webmanifest","./icon-192.png","./icon-512.png","./cosmos.webp","./flags/tr.svg","./flags/gb.svg","./flags/fr.svg","./flags/de.svg","./assets/avatar-fPg01cX_.js","./assets/avatar-view-D8cHHIiM.js","./assets/bundler-DZlxCDEb.js","./assets/cosmos-CNUOFipv.webp","./assets/index-COha8cqs.css","./assets/index-Dlfa7TfG.js","./assets/match-peer-Bvi425-q.js","./assets/multiplayer-DhY-YPSV.js","./assets/scene-DtCBP-yj.js"];
self.addEventListener('install', (event) =>
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(PRECACHE))),
);
self.addEventListener('activate', (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('tumble-club-') && key !== VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener('message', (event) => {
  if (event.data === 'activate-update') self.skipWaiting();
});
self.addEventListener('fetch', (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (
    request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(new URL('./', self.location.href).pathname)
  )
    return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(VERSION).then((cache) => cache.put('./', copy));
          }
          return response;
        })
        .catch(() => caches.match('./')),
    );
  } else if (
    /\.(?:js|css|png|webp|svg|woff2|webmanifest)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              void caches
                .open(VERSION)
                .then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
