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
// See lib.mjs for E2E_GL, E2E_SLOW and E2E_TIMEOUT_SCALE.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { buildApp, skipBuild } from "./lib.mjs";

const SCRIPTS = ["smoke.mjs", "recovery.mjs", "save-errors.mjs", "canvas.mjs", "offline-update.mjs", "a11y.mjs"];
const started = Date.now();
const passthrough = process.argv.slice(2).filter((a) => a === "--headed");

if (!skipBuild) {
  console.log("· build");
  await buildApp();
}

const results = [];
for (const name of SCRIPTS) {
  console.log(`\n=== ${name}`);
  const t0 = Date.now();
  const out = await new Promise((resolve) => {
    let text = "";
    const child = spawn(process.execPath, [fileURLToPath(new URL(name, import.meta.url)), "--no-build", ...passthrough], { stdio: ["ignore", "pipe", "inherit"] });
    child.stdout.on("data", (d) => {
      text += d;
      process.stdout.write(d);
    });
    child.on("close", (code) => resolve({ code, text }));
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
