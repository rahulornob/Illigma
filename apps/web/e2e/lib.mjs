// Shared helpers for the Illigma web app's end-to-end scripts.
//
// Every script is plain Node + Playwright: it builds the app (unless
// --no-build), serves the production build with `vite preview`, drives
// Chromium, and exits non-zero on the first failed check. Known bugs are
// logged as "KNOWN BUG" and never fail the run.
//
// Common flags: --headed (show the browser), --no-build (reuse dist/).
// Screenshots go to apps/web/e2e/out/ (or $SMOKE_OUT).
//
// Environment:
//   E2E_GL=gpu|swiftshader  WebGL backend. "gpu" uses the machine's GPU;
//                           "swiftshader" is software GL for machines without
//                           one (Linux CI, Docker). Default: swiftshader on
//                           Linux, gpu elsewhere.
//   E2E_SLOW=1 (or a rate)  Throttle every page's CPU through CDP (4x by
//                           default) to shake out timing races.
//   E2E_SLOW_DISK=ms        Delay every OPFS write commit in the scripts that
//                           simulate disk failures (recovery, save-errors).
//   E2E_TIMEOUT_SCALE=n     Multiply wait timeouts. Default: the E2E_SLOW
//                           rate, and x2 when CI is set. Waits poll observable
//                           state, so a longer timeout never slows a passing run.
//   E2E_STEP_TIMEOUT=ms     Fail a script whose current step (the last log())
//                           runs longer than this (default 120 s, scaled by T()).
//                           Playwright's page.evaluate() has no timeout of its
//                           own: a promise in the page that never settles (an
//                           animation frame in a page that stopped drawing, an
//                           OPFS call that never returns) would otherwise wait
//                           forever. The script then says which step stalled,
//                           saves a screenshot and exits; Playwright closes the
//                           browser on exit.
//
// Rule for checks: never assert right after a fixed sleep. Wait for the state
// you expect (waitFor, waitForSelector, poll, eventually, stableShot). A fixed
// wait is only fine before a negative check ("nothing else happens").

import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { build, preview } from "vite";

export const root = fileURLToPath(new URL("../", import.meta.url));
export const configFile = `${root}vite.config.ts`;
export const outDir = process.env.SMOKE_OUT ?? fileURLToPath(new URL("./out/", import.meta.url));
export const headed = process.argv.includes("--headed");
export const skipBuild = process.argv.includes("--no-build");

mkdirSync(outDir, { recursive: true });

/** CPU throttling rate from E2E_SLOW (0 = off). */
export const cpuSlowdown = (() => {
  const v = process.env.E2E_SLOW;
  if (!v || v === "0") return 0;
  const n = Number(v);
  return n > 1 ? n : 4;
})();

/** WebGL backend: "gpu" or "swiftshader" (software). */
export const glMode = process.env.E2E_GL || (process.platform === "linux" ? "swiftshader" : "gpu");
if (!["gpu", "swiftshader"].includes(glMode)) throw new Error(`E2E_GL must be "gpu" or "swiftshader", got "${glMode}"`);

const timeScale = Number(process.env.E2E_TIMEOUT_SCALE) || Math.max(1, cpuSlowdown) * (process.env.CI ? 2 : 1);
/** A wait timeout scaled for slow machines (E2E_SLOW, CI). Use it for every positive wait. */
export const T = (ms) => Math.round(ms * timeScale);

/** Build the app. `extra` is merged into the Vite config (e.g. another outDir or plugins). */
export async function buildApp(extra = {}) {
  await build({ root, configFile, logLevel: "error", ...extra });
}

/**
 * A free port from the OS (listen on 0). Fixed ports made two suites running
 * at once (two checkouts, a CI matrix) fail with "Port … is already in use".
 */
export function pickPort() {
  return new Promise((resolve, reject) => {
    const s = createServer()
      .once("error", reject)
      .listen(0, () => {
        const { port } = s.address();
        s.close(() => resolve(port));
      });
  });
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
  // Closing waits for open connections: drop them (a browser that didn't shut down cleanly may keep some).
  const close = () =>
    within(
      new Promise((r) => {
        server.httpServer.close(r);
        server.httpServer.closeAllConnections?.();
      }),
      10_000,
    );
  return { server, url: `http://localhost:${port}/`, close };
}

/** `promise`, or undefined once `ms` have passed: cleanup that must never hang a run. */
export function within(promise, ms) {
  let timer;
  return Promise.race([promise, new Promise((r) => (timer = setTimeout(r, ms)))]).finally(() => clearTimeout(timer));
}

/**
 * Chromium flags per WebGL backend. The canvas is CanvasKit on WebGL 2.
 * - gpu: the real GPU (on macOS, ANGLE on Metal, Chromium's default there).
 * - swiftshader: ANGLE on SwiftShader, a CPU implementation of Vulkan. Recent
 *   Chromium no longer falls back to SwiftShader for WebGL on its own: it has
 *   to be asked for and allowed (--enable-unsafe-swiftshader). Playwright adds
 *   that flag only on macOS, so on a GPU-less Linux box (CI, Docker) WebGL is
 *   missing without these flags.
 */
const GL_ARGS = {
  gpu: ["--enable-gpu", "--ignore-gpu-blocklist"],
  swiftshader: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
};

export async function launch() {
  return chromium.launch({ headless: !headed, args: GL_ARGS[glMode] });
}

/** The WebGL 2 renderer string the browser got, or null without WebGL 2. */
export async function webglRenderer(browser) {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    return await page.evaluate(() => {
      const gl = document.createElement("canvas").getContext("webgl2");
      if (!gl) return null;
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      return String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    });
  } finally {
    await context.close();
  }
}

/**
 * A fresh browser profile (its own OPFS, caches and service worker), at the
 * editor's design size. With E2E_SLOW, every page opened with
 * context.newPage() is CPU-throttled before the test gets it.
 */
export async function newContext(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  context.setDefaultTimeout(T(30_000));
  if (cpuSlowdown) {
    const newPage = context.newPage.bind(context);
    context.newPage = async () => {
      const page = await newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpuSlowdown });
      return page;
    };
  }
  return context;
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
export const selectedRows = (page) => page.locator('.layer-list .layer-row[aria-selected="true"]');

/** Wait until the editor is up and the canvas has started. On failure, says why the canvas didn't start (e.g. no WebGL). */
export async function canvasReady(page) {
  await page.locator(".title-bar").waitFor({ timeout: T(30_000) });
  try {
    await page.waitForSelector(".canvas-status", { state: "detached", timeout: T(30_000) });
  } catch (e) {
    const status = await page.locator(".canvas-status").innerText({ timeout: 1_000 }).catch(() => "");
    throw new Error(`the canvas didn't start${status ? `: "${status}"` : ""} (${String(e?.message ?? e).split("\n")[0]})`);
  }
}

export const waitSaveState = (page, state, timeout = T(15_000)) => page.waitForSelector(`.save-status[data-save-state="${state}"]`, { timeout });
export const waitSaved = (page, timeout = T(15_000)) => waitSaveState(page, "saved", timeout);
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
 * `__e2eFail` can also be a function ({ name, journal, append }) => "fail" |
 * "hold" | anything else (write normally); "hold" keeps the write open until
 * `__e2eRelease()` and counts it in `__e2eHeld`.
 * `window.__e2eFailedWrites` counts the failed writes. With E2E_SLOW_DISK=<ms>,
 * every write also takes that long to commit, like a slow disk: saves stay in
 * flight longer, which widens any race between a save and the test.
 * Use as page.addInitScript(failWritesInit).
 */
function failWrites(slowDiskMs) {
  const proto = FileSystemFileHandle.prototype;
  const createWritable = proto.createWritable;
  proto.createWritable = async function (options) {
    const stream = await createWritable.call(this, options);
    const name = this.name;
    const append = !!options?.keepExistingData;
    const close = stream.close.bind(stream);
    stream.close = async () => {
      if (slowDiskMs) await new Promise((r) => setTimeout(r, slowDiskMs));
      let mode = globalThis.__e2eFail;
      const journal = name.endsWith(".ndjson");
      if (typeof mode === "function") mode = mode({ name, journal, append });
      if (mode === "hold") {
        // Keep this write open (not committed) until the test calls __e2eRelease().
        globalThis.__e2eHeld = (globalThis.__e2eHeld ?? 0) + 1;
        globalThis.__e2eGate ??= new Promise((r) => (globalThis.__e2eRelease = r));
        await globalThis.__e2eGate;
        return close();
      }
      const fail = mode === "fail" || (mode === "package" && !journal) || (mode === "journal-clear" && journal && !append);
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
export const failWritesInit = { content: `(${failWrites})(${Number(process.env.E2E_SLOW_DISK) || 0});` };

/** How many writes failWritesInit has failed on `page` so far. */
export const failedWrites = (page) => page.evaluate(() => globalThis.__e2eFailedWrites ?? 0);

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

/**
 * Poll the async `fn` from Node until it returns truthy, and return that value
 * (page.waitForFunction doesn't await promises). `timeout` is scaled by T().
 */
export async function poll(fn, message, timeout = 5_000, every = 50) {
  const deadline = Date.now() + T(timeout);
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > deadline) throw new Error(`timed out: ${message}`);
    await new Promise((r) => setTimeout(r, every));
  }
}

/** Like poll(), but resolves to true or false instead of throwing: `check(await eventually(...), message)`. */
export const eventually = (fn, timeout = 5_000) => poll(fn, "", timeout).then(Boolean, () => false);

/** Wait until two screenshots of `locator` in a row are identical (drawing has settled); returns that image. */
export async function stableShot(locator, timeout = 5_000) {
  let last = await locator.screenshot();
  return poll(
    async () => {
      const next = await locator.screenshot();
      const same = next.equals(last);
      last = next;
      return same && next;
    },
    "the canvas should stop changing",
    timeout,
  );
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
 * Run one e2e script. `body` gets { browser, url, port, log, check, knownBug, outDir, errors }.
 * Builds (unless --no-build), serves on a free port (also passed to `body` as `port`, for
 * scripts that serve themselves), launches Chromium, and always cleans up.
 * Prints a check count and exits non-zero on failure.
 */
export async function runE2E(name, { build: doBuild = true, serve: doServe = true } = {}, body) {
  const started = Date.now();
  let step = "start";
  let stepStarted = Date.now();
  let checks = 0;
  const known = [];
  const log = (s) => {
    step = s;
    stepStarted = Date.now();
    console.log(`· ${s}`);
  };
  // A step that stalls fails the script, with the step's name, instead of hanging the whole run.
  const stepTimeout = T(Number(process.env.E2E_STEP_TIMEOUT) || 120_000);
  const watchdog = setInterval(() => {
    const secs = (Date.now() - stepStarted) / 1000;
    if (secs * 1000 < stepTimeout) return;
    clearInterval(watchdog);
    console.error(`✗ ${name} stalled at "${step}": no progress for ${secs.toFixed(0)} s (E2E_STEP_TIMEOUT ${stepTimeout / 1000} s)`);
    const shots = (browser?.contexts() ?? []).map((ctx) => ctx.pages().at(-1)?.screenshot({ path: `${outDir}/${name}-stalled.png`, timeout: 5_000 }).catch(() => undefined));
    void within(Promise.all(shots), 8_000).finally(() => {
      console.log(`E2E_RESULT ${JSON.stringify({ name, ok: false, checks, known, stalled: step })}`);
      process.exit(1); // Playwright closes the browsers it launched as this process exits
    });
  }, 1_000);
  watchdog.unref();
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
    const port = await pickPort();
    if (doServe) server = await serve(port);
    browser = await launch();
    const renderer = await webglRenderer(browser);
    console.log(`· WebGL 2: ${renderer ?? "none"} (E2E_GL=${glMode}${cpuSlowdown ? `, CPU ${cpuSlowdown}x slower` : ""})`);
    if (!renderer) throw new Error(`Chromium has no WebGL 2 with E2E_GL=${glMode}, so the canvas can't start. Without a GPU, use E2E_GL=swiftshader.`);
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
      await page?.screenshot({ path: `${outDir}/${name}-failure.png`, timeout: 10_000 }).catch(() => undefined);
    }
  } finally {
    step = "clean up";
    stepStarted = Date.now();
    await within(browser?.close().catch(() => undefined), 20_000);
    await server?.close();
    clearInterval(watchdog);
  }
  console.log(`E2E_RESULT ${JSON.stringify({ name, ok: code === 0, checks, known })}`);
  process.exit(code);
}
