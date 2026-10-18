/**
 * The service worker and app updates. A new version installs in the
 * background and waits; the app shows "Update ready · Reload", and only that
 * click switches versions, so an update never swaps code under an open file.
 */

const listeners = new Set<() => void>();
let waiting: ServiceWorker | null = null;
let switching = false;

function setWaiting(worker: ServiceWorker): void {
  waiting = worker;
  for (const l of [...listeners]) l();
}

/** For useSyncExternalStore: is a new version installed and waiting? */
export function updateReady(): boolean {
  return waiting !== null;
}

export function subscribeUpdate(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Switch to the waiting version; the page reloads once it has taken over. */
export function applyUpdate(): void {
  if (!waiting) return;
  switching = true;
  waiting.postMessage({ type: "SKIP_WAITING" });
}

/** Tell the service worker which version this page runs, so it can drop older caches once no tab needs them. */
function hello(): void {
  navigator.serviceWorker.controller?.postMessage({ type: "HELLO", script: import.meta.url });
}

export function registerServiceWorker(url: string): void {
  const sw = navigator.serviceWorker;
  sw.addEventListener("controllerchange", () => {
    if (switching) {
      switching = false;
      location.reload();
    }
  });
  window.addEventListener("load", () => {
    // updateViaCache "none": the browser always asks the server for sw.js and the files it imports.
    sw.register(url, { updateViaCache: "none" })
      .then((reg) => {
        // An update is "ready" only when an older version controls this page; the first install just activates.
        const track = (worker: ServiceWorker | null) => {
          if (!worker) return;
          const check = () => {
            if (worker.state === "installed" && sw.controller) setWaiting(worker);
          };
          check();
          worker.addEventListener("statechange", check);
        };
        track(reg.waiting);
        track(reg.installing);
        reg.addEventListener("updatefound", () => track(reg.installing));
        hello();
        // Long-lived tabs look for a new version now and then, and when they come back to the front.
        setInterval(() => void reg.update().catch(() => undefined), 60 * 60 * 1000);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            hello();
            void reg.update().catch(() => undefined);
          }
        });
      })
      .catch((err: unknown) => {
        console.warn("Illigma couldn't install its offline cache.", err);
      });
  });
}
