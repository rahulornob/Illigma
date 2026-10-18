// Offline use and app updates through the service worker.
//
// 1. Build "v1", load it, create a file, go offline and reload: the app and
//    the file must open from the cache.
// 2. Rebuild as "v2" (a changed index.html, so a new precache version), go
//    online and reload: record when the new version actually shows up. The
//    service worker is cache-first and calls skipWaiting(), so the expected
//    behaviour is: the first load after a deploy still runs v1 while v2
//    installs in the background; the next load runs v2.
//
// Builds into apps/web/e2e/out/offline-dist so the shared dist/ is untouched.
// Usage (from the repo root):  node apps/web/e2e/offline-update.mjs [--headed]

import { fileURLToPath } from "node:url";
import { buildApp, canvasReady, createFile, drag, layerRows, newContext, runE2E, serve, waitSaved, watchErrors } from "./lib.mjs";

const PORT = 5196;
const dist = fileURLToPath(new URL("./out/offline-dist/", import.meta.url));

/** Build into `dist` with a marker in index.html: <meta name="illigma-e2e-build" content="…">. */
const buildMarked = (mark) =>
  buildApp({
    build: { outDir: dist, emptyOutDir: true },
    plugins: [{ name: "e2e-build-mark", transformIndexHtml: () => [{ tag: "meta", attrs: { name: "illigma-e2e-build", content: mark }, injectTo: "head" }] }],
  });

await runE2E("offline-update", { port: PORT, build: false, serve: false }, async ({ browser, log, check, outDir, errors }) => {
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
    await page.locator(".file-card").first().waitFor({ timeout: 10_000 });
    await page.locator(".file-card").first().click();
    await canvasReady(page);
    check(page.url().includes(fileId), "the file should open from Recents offline");
    await page.screenshot({ path: `${outDir}/offline.png` });

    log("deploy v2 (changed index.html) and go back online");
    await server.close();
    await buildMarked("v2");
    server = await serve(PORT, dist);
    await context.setOffline(false);

    log("first load after the deploy");
    await page.reload();
    await canvasReady(page);
    const first = await mark(page);
    console.log(`  first load after deploy runs ${first}`);
    check(first === "v1" || first === "v2", `unexpected build mark ${first}`);
    // The browser checks sw.js and its imported precache-manifest.js on navigation; give v2 time to install and activate.
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const keys = await caches(page);
      if (keys.length === 1 && keys[0] !== v1Caches[0]) break;
      await page.waitForTimeout(250);
    }
    const afterInstall = await caches(page);
    console.log(`  caches: ${v1Caches.join(", ")} → ${afterInstall.join(", ")}`);
    check(afterInstall.length === 1 && afterInstall[0] !== v1Caches[0], "v2 should replace the v1 cache once it activates");

    log("next load runs the new version");
    await page.reload();
    await canvasReady(page);
    const second = await mark(page);
    console.log(`  second load after deploy runs ${second}`);
    check(second === "v2", `the second load after a deploy should run v2, got ${second}`);
    check((await layerRows(page).count()) === layers, "the file should survive the app update");

    log("offline again: v2 is what's cached");
    await context.setOffline(true);
    await page.reload();
    await canvasReady(page);
    check((await mark(page)) === "v2", "offline after the update should serve v2");
    check((await layerRows(page).count()) === layers, "the file should open offline after the update");
    await context.setOffline(false);
    console.log(
      `  behaviour: ${first === "v1" ? "the first load after a deploy runs the old version (cache-first); v2 installs in the background and the next load runs it" : "the first load after a deploy already runs v2"}. No "update available" prompt is shown.`,
    );
    await context.close();
  } finally {
    await server.close();
  }
});
