/* Recut service worker.
   Caches the app shell so it can open and run with no network connection,
   since all real data already lives in localStorage/IndexedDB on the device,
   not on a server. This file does nothing until the app is actually hosted
   on https:// (or localhost) and registered from the page — see the
   navigator.serviceWorker.register() call in macro-engine-v2.html. */

const CACHE_NAME = 'recut-shell-v1';

/* Core files needed to open the app at all. Paths are relative to wherever
   this file is deployed, so this list should stay in sync with whatever
   the app's HTML file is actually named if that ever changes. */
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

/* Third-party libraries used by the import/scan features. Best-effort only:
   if any of these fail to fetch during install (e.g. offline-first install,
   or a CDN hiccup), the app shell above still gets cached and installs fine. */
const CDN_EXTRAS = [
  'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL);
      await Promise.all(CDN_EXTRAS.map(url =>
        cache.add(url).catch(() => { /* ignore, best-effort */ })
      ));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

/* Cache-first for the app shell, so it opens instantly and works offline.
   Anything not already cached falls back to the network, and successful
   GET responses get cached along the way for next time. Food search,
   barcode lookups, and any other live API calls always need real network
   and aren't meant to be cached here. */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
