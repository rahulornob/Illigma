// Offline use and app updates through the service worker.
//
// 1. Build "v1", load it, create a file, go offline and reload: the app and
//    the file must open from the cache.
// 2. Rebuild as "v2" (a changed index.html, so a new precache version), go
//    online and reload. The service worker is cache-first and never takes
//    over on its own: v1 keeps running (even across reloads) while v2
//    installs and waits, and the app shows "Update ready · Reload". Only that
//    click switches to v2; the v1 cache stays until no tab runs v1.
//
// Builds into apps/web/e2e/out/offline-dist-<pid> (removed afterwards) so the
// shared dist/ is untouched and two runs at once don't overwrite each other.
// Usage (from the repo root):  node apps/web/e2e/offline-update.mjs [--headed]

import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { T, buildApp, canvasReady, createFile, drag, layerRows, newContext, poll, runE2E, serve, waitSaved, watchErrors } from "./lib.mjs";

const dist = fileURLToPath(new URL(`./out/offline-dist-${process.pid}/`, import.meta.url));
process.on("exit", () => rmSync(dist, { recursive: true, force: true }));

/** Build into `dist` with a marker in index.html: <meta name="illigma-e2e-build" content="…">. */
const buildMarked = (mark) =>
  buildApp({
    build: { outDir: dist, emptyOutDir: true },
    plugins: [{ name: "e2e-build-mark", transformIndexHtml: () => [{ tag: "meta", attrs: { name: "illigma-e2e-build", content: mark }, injectTo: "head" }] }],
  });

// The port is picked once and reused for v2: the service worker and OPFS belong to the origin.
await runE2E("offline-update", { build: false, serve: false }, async ({ browser, port: PORT, log, check, outDir, errors }) => {
  const mark = (page) => page.evaluate(() => document.querySelector('meta[name="illigma-e2e-build"]')?.getAttribute("content") ?? null);
  const caches = (page) => page.evaluate(async () => (await self.caches.keys()).filter((k) => k.startsWith("illigma-")).sort());
  const swState = (page) =>
    page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration();
      return { active: r?.active?.state ?? null, waiting: !!r?.waiting, installing: !!r?.installing, controlled: !!navigator.serviceWorker.controller };
    });

  log("build v1 and serve it");
  await buildMarked("v1");
  let server = await serve(PORT, dist);
  const url = server.url;
  try {
    const context = await newContext(browser);
    const page = await context.newPage();
    watchErrors(page, errors);

    log("first load installs the service worker");
    const fileId = await createFile(page, url);
    await page.keyboard.press("r");
    const box = await page.locator("canvas.canvas").boundingBox();
    await drag(page, box.x + 60, box.y + box.height - 160, box.x + 160, box.y + box.height - 100);
    await waitSaved(page);
    const layers = await layerRows(page).count();
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
      await page.reload();
      await canvasReady(page);
    }
    check((await swState(page)).controlled, "the service worker should control the page after the first load");
    check((await mark(page)) === "v1", "the first load should run v1");
    const v1Caches = await caches(page);
    check(v1Caches.length === 1, `one app cache expected after install, got ${v1Caches.join(", ")}`);

    log("offline: reload opens the app and the file");
    await context.setOffline(true);
    await page.reload();
    await canvasReady(page);
    check((await layerRows(page).count()) === layers, "the file should open offline with every layer");
    check((await mark(page)) === "v1", "offline should serve the cached v1");

    log("offline: a cold start on the home screen lists the file");
    await page.goto(url);
    await page.locator(".file-card").first().waitFor({ timeout: T(10_000) });
    await page.locator(".file-card").first().click();
    await canvasReady(page);
    check(page.url().includes(fileId), "the file should open from Recents offline");
    await page.screenshot({ path: `${outDir}/offline.png` });

    log("deploy v2 (changed index.html) and go back online");
    await server.close();
    await buildMarked("v2");
    server = await serve(PORT, dist);
    await context.setOffline(false);

    log("first load after the deploy keeps v1 and offers the update");
    await page.reload();
    await canvasReady(page);
    check((await mark(page)) === "v1", "the first load after a deploy should still run v1 (cache-first)");
    // The browser checks sw.js and its imported precache-manifest.js on navigation; v2 installs and waits.
    const toast = page.locator(".update-toast");
    await toast.waitFor({ timeout: T(20_000) });
    check((await toast.innerText()).replace(/\s+/g, " ").trim() === "Update ready · Reload", `the app should say "Update ready · Reload", got "${await toast.innerText()}"`);
    check((await swState(page)).waiting, "v2 should wait instead of taking over");
    const both = await caches(page);
    check(both.length === 2 && both.includes(v1Caches[0]), `v1's cache should stay while v1 runs, got ${both.join(", ")}`);

    log("a plain reload doesn't switch versions");
    await page.reload();
    await canvasReady(page);
    check((await mark(page)) === "v1", "without the click, the page should keep running v1");

    log("Reload in the update notice switches to v2");
    await page.locator(".update-toast").getByRole("button", { name: "Reload" }).click();
    await page.waitForFunction(() => document.querySelector('meta[name="illigma-e2e-build"]')?.getAttribute("content") === "v2", undefined, { timeout: T(20_000) });
    await canvasReady(page);
    check((await layerRows(page).count()) === layers, "the file should survive the app update");
    check((await page.locator(".update-toast").count()) === 0, "the update notice should be gone after switching");
    const afterUpdate = await poll(async () => {
      const keys = await caches(page);
      return keys.length === 1 && keys;
    }, "only one app cache should be left", 10_000).catch(() => caches(page));
    console.log(`  caches: ${v1Caches.join(", ")} → ${afterUpdate.join(", ")}`);
    check(afterUpdate.length === 1 && afterUpdate[0] !== v1Caches[0], "once no tab runs v1, its cache should be removed");

    log("offline again: v2 is what's cached");
    await context.setOffline(true);
    await page.reload();
    await canvasReady(page);
    check((await mark(page)) === "v2", "offline after the update should serve v2");
    check((await layerRows(page).count()) === layers, "the file should open offline after the update");
    await context.setOffline(false);
    await context.close();
  } finally {
    await server.close();
  }
});
