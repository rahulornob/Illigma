/*
 * Illigma service worker. Hand-written on purpose: no Workbox, no network
 * calls beyond this app's own files.
 *
 * Install: precache every built file listed in precache-manifest.js (written
 * at build time by vite.config.ts). Fetch: answer same-origin GET requests
 * from the cache first, so the app opens with no network at all.
 */

/* global self, caches */
importScripts("precache-manifest.js");

const { version, files } = self.__ILLIGMA_PRECACHE__;
const CACHE = `illigma-${version}`;
const scope = new URL(self.registration.scope);
const INDEX = new URL("index.html", scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(files.map((f) => new URL(f, scope).href)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("illigma-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== scope.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      // Navigations always get the app shell; routing happens in the page.
      if (request.mode === "navigate") {
        const shell = await cache.match(INDEX);
        if (shell) return shell;
      }
      const hit = await cache.match(request, { ignoreSearch: url.pathname.endsWith(".html") });
      if (hit) return hit;
      const response = await fetch(request);
      if (response.ok && response.type === "basic") cache.put(request, response.clone());
      return response;
    })(),
  );
});
