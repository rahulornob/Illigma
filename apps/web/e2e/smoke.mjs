// Smoke test for the Illigma web app (Phase 0 milestone 0.5).
//
// Builds the app, serves the production build, and drives it in Chromium:
// create a file, draw a rectangle, undo and redo, edit a property, save,
// reload, reopen from Recents, then go offline and reload from the service
// worker cache. Exits non-zero on the first failure.
//
// Usage (from the repo root):  node apps/web/e2e/smoke.mjs [--headed] [--no-build]
// Screenshots go to apps/web/e2e/out/ (or $SMOKE_OUT). Helpers live in lib.mjs.

import { T, canvasReady, eventually, layerRows, newContext, runE2E, stableShot, waitSaved as waitSavedOn, watchErrors } from "./lib.mjs";

await runE2E("smoke", {}, async ({ browser, url: URL_, log, check, outDir, errors }) => {
  const context = await newContext(browser);
  const page = await context.newPage();
  watchErrors(page, errors);
  const rectangleRows = () => page.locator(".layer-list .layer-row", { hasText: /^Rectangle \d+$/ });
  const waitSaved = () => waitSavedOn(page);
  const layerRowsHere = () => layerRows(page);

  log("open home");
  await page.goto(URL_);
  await page.getByRole("button", { name: "New design file" }).waitFor();
  await page.getByText("No files yet").waitFor({ timeout: T(5_000) }).catch(() => check(false, "a fresh browser should have no recent files"));

  log("create a file");
  await page.getByRole("button", { name: "New design file" }).click();
  await page.locator(".title-bar").waitFor();
  await canvasReady(page);
  check(/#\/file\/\w+/.test(page.url()), `the URL should name the file, got ${page.url()}`);
  const before = await layerRowsHere().count();
  check(before === 7, `the sample file should have 7 layers (Desktop, Hero, Avatar, and a card with three), found ${before}`);
  await page.screenshot({ path: `${outDir}/editor-new.png` });

  log("draw a rectangle");
  await page.keyboard.press("r");
  check((await page.getByRole("button", { name: "Rectangle (R)" }).getAttribute("aria-pressed")) === "true", "R should pick the Rectangle tool");
  const box = await page.locator("canvas.canvas").boundingBox();
  check(box, "canvas not found");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx - 120, cy + 40);
  await page.mouse.down();
  await page.mouse.move(cx - 40, cy + 100, { steps: 5 });
  await page.mouse.move(cx + 60, cy + 160, { steps: 5 });
  await page.mouse.up();
  await rectangleRows().first().waitFor();
  check((await layerRowsHere().count()) === before + 1, "drawing should add one layer");
  check((await page.getByRole("button", { name: "Move (V)" }).getAttribute("aria-pressed")) === "true", "the tool should return to Move after drawing");
  const w = Number(await page.getByLabel("Width").inputValue());
  const h = Number(await page.getByLabel("Height").inputValue());
  check(w > 1 && h > 1, `the new rectangle should be selected with a size, got ${w} × ${h}`);

  log("undo and redo");
  await page.keyboard.press("ControlOrMeta+z");
  await page.waitForFunction((n) => document.querySelectorAll(".layer-list .layer-row").length === n, before);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await page.waitForFunction((n) => document.querySelectorAll(".layer-list .layer-row").length === n, before + 1);

  log("edit X in the Properties panel");
  await rectangleRows().first().click();
  const x = page.getByLabel("X position");
  await x.fill("40");
  await x.press("Enter");
  check((await x.inputValue()) === "40", "X should read 40 after editing");

  log("zoom shortcuts");
  const zoomText = () => page.locator(".zoom-value").innerText();
  await page.locator("canvas.canvas").focus();
  const z0 = await zoomText();
  await page.keyboard.press("ControlOrMeta+Equal");
  check(await eventually(async () => (await zoomText()) !== z0), "⌘+ should zoom in");
  await page.keyboard.press("Shift+Digit1");
  check(await eventually(async () => (await zoomText()) === z0), `⇧1 should fit the page again (${z0})`);

  log("save");
  await page.keyboard.press("ControlOrMeta+s");
  await waitSaved();
  check((await page.locator(".save-status").innerText()).startsWith("Saved"), "status should read Saved");
  await page.screenshot({ path: `${outDir}/editor.png` });

  log("reload reopens the file");
  await page.reload();
  await page.locator(".title-bar").waitFor();
  await canvasReady(page);
  check((await layerRowsHere().count()) === before + 1, "the drawn rectangle should survive a reload");
  await rectangleRows().first().click();
  check((await page.getByLabel("X position").inputValue()) === "40", "the X edit should survive a reload");

  log("recents list and reopen");
  await page.getByRole("button", { name: "Back to files" }).click();
  const card = page.locator(".file-card", { hasText: "Untitled" });
  await card.first().waitFor();
  check((await card.count()) === 1, "the file should appear once in Recents");
  await page.screenshot({ path: `${outDir}/home.png` });
  await card.first().click();
  await canvasReady(page);
  check((await layerRowsHere().count()) === before + 1, "reopening from Recents should show every layer");

  log("works offline from the service worker cache");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
    await page.reload();
    await canvasReady(page);
  }
  check(await page.evaluate(() => !!navigator.serviceWorker.controller), "the service worker should control the page");
  await context.setOffline(true);
  await page.reload();
  await canvasReady(page);
  check((await layerRowsHere().count()) === before + 1, "the file should open offline");
  await context.setOffline(false);

  log("a second tab on the same file opens read-only");
  const second = await context.newPage();
  watchErrors(second, errors);
  await second.goto(page.url());
  await canvasReady(second);
  const readOnly = second.locator(".banner", { hasText: "Open in another tab — read-only here." });
  await readOnly.waitFor({ timeout: T(5_000) });
  check((await second.locator(".save-status").innerText()).trim() === "Read-only", "the second tab's title bar should read Read-only");
  check((await second.locator(".banner", { hasText: "Recovered unsaved changes." }).count()) === 0, "the second tab must not offer the first tab's journal as recovered");
  await second.locator("canvas.canvas").focus();
  await second.keyboard.press("r");
  check((await second.getByRole("button", { name: "Move (V)" }).getAttribute("aria-pressed")) === "true", "drawing tools should stay off in a read-only tab");
  await rectangleRows().first().click();
  await second.locator(".layer-list .layer-row", { hasText: /^Rectangle \d+$/ }).first().click();
  check((await second.getByLabel("X position").getAttribute("readonly")) !== null, "Properties should be read-only in the second tab");
  check((await page.locator(".banner", { hasText: "read-only here" }).count()) === 0, "the first tab keeps editing");
  await second.close();

  log("the canvas comes back after the GPU context is lost");
  await page.locator("canvas.canvas").focus();
  await page.keyboard.press("Escape"); // no selection overlay in the shots
  const canvasEl = page.locator("canvas.canvas");
  const shot = () => canvasEl.screenshot();
  const drawn = await stableShot(canvasEl); // the redraw after Escape has finished
  const lost = await page.evaluate(() => {
    const ext = document.querySelector("canvas.canvas")?.getContext("webgl2")?.getExtension("WEBGL_lose_context");
    if (!ext) return false;
    ext.loseContext();
    globalThis.__restore = () => ext.restoreContext();
    return true;
  });
  console.log(`  WebGL context loss simulated: ${lost}`);
  if (lost) {
    check(await eventually(async () => !(await shot()).equals(drawn)), "losing the WebGL context should blank the canvas (the simulation worked)");
    await page.evaluate(() => globalThis.__restore());
    check(await eventually(async () => (await shot()).equals(drawn), 10_000), "the canvas should draw the page again after the WebGL context is restored");
    check((await page.locator(".canvas-status").count()) === 0, "the canvas should not show an error after the context is restored");
  }
});
