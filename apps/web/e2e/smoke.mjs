// Smoke test for the Illigma web app (Phase 0 milestone 0.5).
//
// Builds the app, serves the production build, and drives it in Chromium:
// create a file, draw a rectangle, undo and redo, edit a property, save,
// reload, reopen from Recents, then go offline and reload from the service
// worker cache. Exits non-zero on the first failure.
//
// Usage (from the repo root):  node apps/web/e2e/smoke.mjs [--headed] [--no-build]
// Screenshots go to apps/web/e2e/out/ (or $SMOKE_OUT).

import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { build, preview } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const outDir = process.env.SMOKE_OUT ?? fileURLToPath(new URL("./out/", import.meta.url));
const headed = process.argv.includes("--headed");
const PORT = 5192;
const URL_ = `http://localhost:${PORT}/`;

mkdirSync(outDir, { recursive: true });

let step = "start";
const check = (cond, message) => {
  if (!cond) throw new Error(message);
};
const log = (s) => {
  step = s;
  console.log(`· ${s}`);
};

if (!process.argv.includes("--no-build")) {
  log("build");
  await build({ root, configFile: `${root}vite.config.ts`, logLevel: "error" });
}
const server = await preview({ root, configFile: `${root}vite.config.ts`, preview: { port: PORT, strictPort: true }, logLevel: "error" });
const browser = await chromium.launch({ headless: !headed, args: ["--enable-gpu", "--ignore-gpu-blocklist"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

const layerRows = () => page.locator(".layer-list .layer-row");
const rectangleRows = () => page.locator(".layer-list .layer-row", { hasText: /^Rectangle \d+$/ });
const canvasReady = async () => {
  await page.locator(".title-bar").waitFor({ timeout: 30_000 });
  await page.waitForSelector(".canvas-status", { state: "detached", timeout: 30_000 });
};
const waitSaved = () => page.waitForSelector('.save-status[data-save-state="saved"]', { timeout: 15_000 });

let code = 0;
try {
  log("open home");
  await page.goto(URL_);
  await page.getByRole("button", { name: "New design file" }).waitFor();
  await page.getByText("No files yet").waitFor({ timeout: 5_000 }).catch(() => check(false, "a fresh browser should have no recent files"));

  log("create a file");
  await page.getByRole("button", { name: "New design file" }).click();
  await page.locator(".title-bar").waitFor();
  await canvasReady();
  check(/#\/file\/\w+/.test(page.url()), `the URL should name the file, got ${page.url()}`);
  const before = await layerRows().count();
  check(before === 3, `the sample file should have 3 layers, found ${before}`);
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
  check((await layerRows().count()) === before + 1, "drawing should add one layer");
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
  check((await zoomText()) !== z0, "⌘+ should zoom in");
  await page.keyboard.press("Shift+Digit1");
  check((await zoomText()) === z0, `⇧1 should fit the page again (${z0})`);

  log("save");
  await page.keyboard.press("ControlOrMeta+s");
  await waitSaved();
  check((await page.locator(".save-status").innerText()).startsWith("Saved"), "status should read Saved");
  await page.screenshot({ path: `${outDir}/editor.png` });

  log("reload reopens the file");
  await page.reload();
  await page.locator(".title-bar").waitFor();
  await canvasReady();
  check((await layerRows().count()) === before + 1, "the drawn rectangle should survive a reload");
  await rectangleRows().first().click();
  check((await page.getByLabel("X position").inputValue()) === "40", "the X edit should survive a reload");

  log("recents list and reopen");
  await page.getByRole("button", { name: "Back to files" }).click();
  const card = page.locator(".file-card", { hasText: "Untitled" });
  await card.first().waitFor();
  check((await card.count()) === 1, "the file should appear once in Recents");
  await page.screenshot({ path: `${outDir}/home.png` });
  await card.first().click();
  await canvasReady();
  check((await layerRows().count()) === before + 1, "reopening from Recents should show every layer");

  log("works offline from the service worker cache");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
    await page.reload();
    await canvasReady();
  }
  check(await page.evaluate(() => !!navigator.serviceWorker.controller), "the service worker should control the page");
  await context.setOffline(true);
  await page.reload();
  await canvasReady();
  check((await layerRows().count()) === before + 1, "the file should open offline");
  await context.setOffline(false);

  const real = errors.filter((e) => !/favicon/i.test(e));
  check(real.length === 0, `the page logged errors:\n${real.join("\n")}`);
  console.log(`✓ smoke test passed. Screenshots in ${outDir}`);
} catch (e) {
  code = 1;
  console.error(`✗ smoke test failed at "${step}": ${e instanceof Error ? e.message : e}`);
  if (errors.length) console.error(`page errors:\n${errors.join("\n")}`);
  await page.screenshot({ path: `${outDir}/failure.png` }).catch(() => undefined);
} finally {
  await browser.close();
  await new Promise((r) => server.httpServer.close(r));
}
process.exit(code);
