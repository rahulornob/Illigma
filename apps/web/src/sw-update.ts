/**
 * The service worker and app updates. A new version installs in the
 * background and waits; the app shows "Update ready · Reload", and only that
 * click switches versions, so an update never swaps code under an open file.
 * Before it does, the open file's recovery journal and autosave are flushed.
 */

const listeners = new Set<() => void>();
const beforeUpdate = new Set<() => Promise<void>>();
let waiting: ServiceWorker | null = null;
let switching = false;

function setWaiting(worker: ServiceWorker | null): void {
  waiting = worker;
  for (const l of [...listeners]) l();
}

/**
 * Run `flush` before the page reloads into a new version (e.g. append the
 * recovery journal and save). If it throws, the update waits and the error is
 * shown. Returns a function that removes it.
 */
export function onBeforeUpdate(flush: () => Promise<void>): () => void {
  beforeUpdate.add(flush);
  return () => beforeUpdate.delete(flush);
}

/** For useSyncExternalStore: is a new version installed and waiting? */
export function updateReady(): boolean {
  return waiting !== null;
}

export function subscribeUpdate(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Switch to the waiting version: flush the open file first, then the page
 * reloads once the new version has taken over. If another tab already
 * switched (the worker is active), just reload.
 */
export async function applyUpdate(): Promise<void> {
  const worker = waiting;
  if (!worker) return;
  for (const flush of [...beforeUpdate]) await flush();
  if (worker.state === "activating" || worker.state === "activated" || navigator.serviceWorker.controller === worker) {
    location.reload();
    return;
  }
  switching = true;
  worker.postMessage({ type: "SKIP_WAITING" });
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
      return;
    }
    // Another tab switched versions: this one's notice would do nothing now.
    setWaiting(null);
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
