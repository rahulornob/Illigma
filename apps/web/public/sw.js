/*
 * Illigma service worker. Hand-written on purpose: no Workbox, no network
 * calls beyond this app's own files.
 *
 * Install: precache every built file listed in precache-manifest.js (written
 * at build time by vite.config.ts), including the CanvasKit wasm and the
 * Inter fonts, so the editor opens with no network at all. Fetch: answer
 * same-origin GET requests from the cache first.
 *
 * Updates never take over on their own: a new version installs and waits.
 * The page shows "Update ready · Reload" and, on click, posts SKIP_WAITING.
 * Older caches stay until no open tab runs an older version, so a tab that
 * was not reloaded can still load its own files (e.g. the canvas, offline).
 */

/* global self, caches */
importScripts("precache-manifest.js");

const { version, files } = self.__ILLIGMA_PRECACHE__;
const CACHE = `illigma-${version}`;
const scope = new URL(self.registration.scope);
const INDEX = new URL("index.html", scope).href;
/** Absolute URLs of this version's files. */
const OWN = new Set(files.map((f) => new URL(f, scope).href));
/** Window clients known to run this version (they said HELLO with one of its scripts). */
const current = new Set();

/** Requests for this version's files that skip the HTTP cache, so a stale index.html is never stored as this version's. */
const fresh = () => [...OWN].map((url) => new Request(url, { cache: "reload" }));

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(fresh())));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Belt and braces: if anything removed files from this version's cache while it waited, fetch them again.
      const cache = await caches.open(CACHE);
      if ((await cache.keys()).length < OWN.size) await cache.addAll(fresh()).catch(() => undefined);
      await self.clients.claim();
      await removeOldCaches();
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data ?? {};
  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
  } else if (data.type === "HELLO" && event.source) {
    // The page names its own entry script; it runs this version only if that script is one of ours.
    if (typeof data.script === "string" && OWN.has(data.script)) current.add(event.source.id);
    else current.delete(event.source.id);
    event.waitUntil(removeOldCaches());
  }
});

/**
 * Delete older versions' caches once every open window runs this version.
 * Only the active worker does this, and only while no newer one is
 * installing or waiting: their caches are "other" too, and must stay.
 */
async function removeOldCaches() {
  const reg = self.registration;
  const newer = () => reg.active !== self.serviceWorker || reg.installing || reg.waiting;
  if (newer()) return;
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  if (windows.some((c) => !current.has(c.id)) || newer()) return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((k) => k.startsWith("illigma-") && k !== CACHE).map((k) => caches.delete(k)));
}

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
      const hit = (await cache.match(request, { ignoreSearch: url.pathname.endsWith(".html") })) ?? (await caches.match(request)); // a tab still on an older version
      if (hit) return hit;
      const response = await fetch(request);
      if (response.ok && response.type === "basic") cache.put(request, response.clone());
      return response;
    })(),
  );
});
