// Runs every end-to-end script in this folder: builds the app once, then runs
// each script with --no-build, one after another, and prints a summary.
// Exits non-zero if any script fails. Known bugs are listed but don't fail.
//
// Usage (from the repo root):  npm run test:e2e   (or node apps/web/e2e/run-all.mjs [--headed] [--no-build])
//
// CI (Linux, no GPU): the scripts pick software WebGL (SwiftShader) on Linux
// on their own, serve on free ports, and scale wait timeouts when CI is set.
// In mcr.microsoft.com/playwright:v1.56.1-jammy:  npm ci && CI=1 npm run test:e2e
// Shake out timing races locally: E2E_SLOW=1 npm run test:e2e (4x CPU throttle).
// See lib.mjs for E2E_GL, E2E_SLOW, E2E_TIMEOUT_SCALE and E2E_STEP_TIMEOUT.
//
// A script that runs past E2E_SUITE_TIMEOUT (default 10 minutes, scaled like
// the waits) is stopped, with its browser, and counted as failed: one stuck
// script never holds up the rest of the run. Each script runs in its own
// process group, so stopping it also stops the Chromium it launched.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { T, buildApp, skipBuild } from "./lib.mjs";

const SCRIPTS = ["smoke.mjs", "recovery.mjs", "save-errors.mjs", "disk-changes.mjs", "canvas.mjs", "autolayout.mjs", "text.mjs", "paint.mjs", "paint-qc8.mjs", "export.mjs", "offline-update.mjs", "a11y.mjs", "perf.mjs"];
const started = Date.now();
const passthrough = process.argv.slice(2).filter((a) => a === "--headed");

if (!skipBuild) {
  console.log("· build");
  await buildApp();
}

const suiteTimeout = T(Number(process.env.E2E_SUITE_TIMEOUT) || 600_000);
/** The script running now, so Ctrl-C (or a kill) stops its browser too. */
let running = null;
/** Stop a script and everything it started (its process group): SIGTERM, then SIGKILL. */
function stop(child) {
  const kill = (signal) => {
    try {
      process.kill(-child.pid, signal);
    } catch {
      // already gone
    }
  };
  kill("SIGTERM");
  setTimeout(() => kill("SIGKILL"), 5_000).unref();
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (running) stop(running);
    process.exit(130);
  });
}

const results = [];
for (const name of SCRIPTS) {
  console.log(`\n=== ${name}`);
  const t0 = Date.now();
  const out = await new Promise((resolve) => {
    let text = "";
    const child = spawn(process.execPath, [fileURLToPath(new URL(name, import.meta.url)), "--no-build", ...passthrough], { stdio: ["ignore", "pipe", "inherit"], detached: true });
    running = child;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      const step = [...text.matchAll(/^· (.*)$/gm)].at(-1)?.[1] ?? "start";
      console.error(`✗ ${name} ran for more than ${suiteTimeout / 1000} s (E2E_SUITE_TIMEOUT), last at "${step}": stopped`);
      stop(child);
    }, suiteTimeout);
    child.stdout.on("data", (d) => {
      text += d;
      process.stdout.write(d);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      running = null;
      resolve({ code: timedOut ? 1 : code, text });
    });
  });
  const line = out.text.split("\n").find((l) => l.startsWith("E2E_RESULT "));
  const parsed = line ? JSON.parse(line.slice("E2E_RESULT ".length)) : { name, ok: false, checks: 0, known: [] };
  results.push({ ...parsed, ok: parsed.ok && out.code === 0, file: name, secs: (Date.now() - t0) / 1000 });
}

console.log("\n=== summary");
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.file.padEnd(20)} ${String(r.checks).padStart(4)} checks  ${r.known.length} known bugs  ${r.secs.toFixed(1)} s`);
const checks = results.reduce((n, r) => n + r.checks, 0);
const known = results.flatMap((r) => r.known.map((k) => `${r.file}: ${k}`));
console.log(`${checks} checks in ${((Date.now() - started) / 1000).toFixed(1)} s`);
if (known.length) console.log(`\nKnown bugs (logged, not failing):\n${known.map((k) => `  - ${k}`).join("\n")}`);
process.exit(results.every((r) => r.ok) ? 0 : 1);
