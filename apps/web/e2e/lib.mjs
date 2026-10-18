// Shared helpers for the Illigma web app's end-to-end scripts.
//
// Every script is plain Node + Playwright: it builds the app (unless
// --no-build), serves the production build with `vite preview`, drives
// Chromium, and exits non-zero on the first failed check. Known bugs are
// logged as "KNOWN BUG" and never fail the run.
//
// Common flags: --headed (show the browser), --no-build (reuse dist/).
// Screenshots go to apps/web/e2e/out/ (or $SMOKE_OUT).

import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { build, preview } from "vite";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const configFile = `${root}vite.config.ts`;
export const outDir = process.env.SMOKE_OUT ?? fileURLToPath(new URL("./out/", import.meta.url));
export const headed = process.argv.includes("--headed");
export const skipBuild = process.argv.includes("--no-build");

mkdirSync(outDir, { recursive: true });

/** Build the app. `extra` is merged into the Vite config (e.g. another outDir or plugins). */
export async function buildApp(extra = {}) {
  await build({ root, configFile, logLevel: "error", ...extra });
}

/** Serve a production build on `port`. `outDir` defaults to the config's (dist/). */
export async function serve(port, buildOutDir) {
  const server = await preview({
    root,
    configFile,
    preview: { port, strictPort: true },
    logLevel: "error",
    ...(buildOutDir ? { build: { outDir: buildOutDir } } : {}),
  });
  return { server, url: `http://localhost:${port}/`, close: () => new Promise((r) => server.httpServer.close(r)) };
}

export async function launch() {
  return chromium.launch({ headless: !headed, args: ["--enable-gpu", "--ignore-gpu-blocklist"] });
}

/** A fresh browser profile (its own OPFS, caches and service worker), at the editor's design size. */
export function newContext(browser) {
  return browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
}

/** Collect uncaught page errors and console errors into `errors`. */
export function watchErrors(page, errors) {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  return errors;
}

// ---- editor helpers ----

export const layerRows = (page) => page.locator(".layer-list .layer-row");
/** A layer row by its exact layer name (the row's accessible name is "<name>, <type>"). */
export const layerRow = (page, name) => page.locator(".layer-list .layer-row", { hasText: new RegExp(`^${name}$`) });
export const selectedRows = (page) => page.locator('.layer-list .layer-row[aria-pressed="true"]');

export async function canvasReady(page) {
  await page.locator(".title-bar").waitFor({ timeout: 30_000 });
  await page.waitForSelector(".canvas-status", { state: "detached", timeout: 30_000 });
}

export const waitSaved = (page, timeout = 15_000) => page.waitForSelector('.save-status[data-save-state="saved"]', { timeout });
export const saveState = (page) => page.locator(".save-status").getAttribute("data-save-state");

/** Open the home screen and create a new file; resolves once the canvas is drawn. Returns the file id. */
export async function createFile(page, url) {
  await page.goto(url);
  await page.getByRole("button", { name: "New design file" }).click();
  await canvasReady(page);
  const m = /#\/file\/([\w-]+)/.exec(page.url());
  if (!m) throw new Error(`the URL should name the file, got ${page.url()}`);
  return m[1];
}

/** Read a Properties field (X position, Y position, Width, Height) as a number. */
export const field = async (page, label) => Number(await page.getByLabel(label).inputValue());

/** Type a value into a Properties field and commit it with Enter. */
export async function setField(page, label, value) {
  const input = page.getByLabel(label);
  await input.fill(String(value));
  await input.press("Enter");
}

/**
 * Init script: lets a test make OPFS writes fail, like a full or broken disk.
 * `window.__e2eFail` = "package" fails every write to the file's package (the
 * recovery journal still works); "journal-clear" fails only rewrites of the
 * journal (its truncation after a save). The failure happens on close(), where
 * the browser would commit the write, so nothing reaches the disk.
 */
export function failWritesInit() {
  const proto = FileSystemFileHandle.prototype;
  const createWritable = proto.createWritable;
  proto.createWritable = async function (options) {
    const stream = await createWritable.call(this, options);
    const name = this.name;
    const append = !!options?.keepExistingData;
    const close = stream.close.bind(stream);
    stream.close = async () => {
      const mode = globalThis.__e2eFail;
      const journal = name.endsWith(".ndjson");
      const fail = (mode === "package" && !journal) || (mode === "journal-clear" && journal && !append);
      if (fail) {
        globalThis.__e2eFailedWrites = (globalThis.__e2eFailedWrites ?? 0) + 1;
        await stream.abort().catch(() => {});
        throw new DOMException("Simulated full disk (e2e).", "QuotaExceededError");
      }
      return close();
    };
    return stream;
  };
}

/** The recovery journal's text for `fileId`, read straight from OPFS ("" if missing). */
export function readJournal(page, fileId) {
  return page.evaluate(async (id) => {
    try {
      const root = await navigator.storage.getDirectory();
      const dir = await root.getDirectoryHandle("journal");
      return await (await (await dir.getFileHandle(`${id}.ndjson`)).getFile()).text();
    } catch {
      return "";
    }
  }, fileId);
}

/** Poll the async `fn` from Node until it returns truthy (page.waitForFunction doesn't await promises). */
export async function poll(fn, message, timeout = 5_000, every = 100) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > deadline) throw new Error(`timed out: ${message}`);
    await new Promise((r) => setTimeout(r, every));
  }
}

/** Drag on the page from (x1, y1) to (x2, y2) in CSS pixels. */
export async function drag(page, x1, y1, x2, y2, steps = 8) {
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps });
  await page.mouse.move(x2, y2, { steps });
  await page.mouse.up();
}

// ---- runner ----

/**
 * Run one e2e script. `body` gets { browser, url, log, check, knownBug, outDir, errors }.
 * Builds (unless --no-build), serves on `port`, launches Chromium, and always cleans up.
 * Prints a check count and exits non-zero on failure.
 */
export async function runE2E(name, { port, build: doBuild = true, serve: doServe = true }, body) {
  const started = Date.now();
  let step = "start";
  let checks = 0;
  const known = [];
  const log = (s) => {
    step = s;
    console.log(`· ${s}`);
  };
  const check = (cond, message) => {
    checks++;
    if (!cond) throw new Error(message);
  };
  /** A check that documents a known bug: logged, never fails the run. Pass true once the bug is fixed. */
  const knownBug = (ok, message) => {
    if (ok) {
      console.log(`  ✓ (was a KNOWN BUG, now passes: ${message}; make it a regular check)`);
    } else {
      known.push(message);
      console.log(`  ⚠ KNOWN BUG: ${message}`);
    }
  };

  let code = 0;
  let server;
  let browser;
  const errors = [];
  try {
    if (doBuild && !skipBuild) {
      log("build");
      await buildApp();
    }
    if (doServe) server = await serve(port);
    browser = await launch();
    await body({ browser, url: server?.url, port, log, check, knownBug, outDir, errors });
    const real = errors.filter((e) => !/favicon/i.test(e));
    check(real.length === 0, `the page logged errors:\n${real.join("\n")}`);
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`✓ ${name} passed: ${checks} checks${known.length ? `, ${known.length} known bugs` : ""}, ${secs} s. Screenshots in ${outDir}`);
  } catch (e) {
    code = 1;
    console.error(`✗ ${name} failed at "${step}": ${e instanceof Error ? e.message : e}`);
    if (errors.length) console.error(`page errors:\n${errors.join("\n")}`);
    for (const ctx of browser?.contexts() ?? []) {
      const page = ctx.pages().at(-1);
      await page?.screenshot({ path: `${outDir}/${name}-failure.png` }).catch(() => undefined);
    }
  } finally {
    await browser?.close().catch(() => undefined);
    await server?.close();
  }
  console.log(`E2E_RESULT ${JSON.stringify({ name, ok: code === 0, checks, known })}`);
  process.exit(code);
}
