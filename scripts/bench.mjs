// Runs the renderer benchmark (apps/bench) in Chromium and prints the result.
// Usage: node scripts/bench.mjs [--headed]   (build first: npm run build -w @illigma/bench)
import { chromium } from "playwright";
import { createServer } from "vite";
import { fileURLToPath } from "node:url";

const headed = process.argv.includes("--headed");
const root = fileURLToPath(new URL("../apps/bench/", import.meta.url));
const server = await createServer({ root, configFile: `${root}vite.config.ts`, server: { port: 5181 }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch({ headless: !headed, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto("http://localhost:5181/");
const result = await page.waitForFunction(() => window.__bench, null, { timeout: 60000 }).then((h) => h.jsonValue());
await page.screenshot({ path: process.env.BENCH_SHOT ?? "bench.png" });
console.log(JSON.stringify(result, null, 2));
await browser.close();
await server.close();
