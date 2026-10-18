import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin, type ResolvedConfig } from "vite";

const src = (pkg: string) => fileURLToPath(new URL(`../../packages/${pkg}/src/index.ts`, import.meta.url));

/** Files in `dir`, as "/"-separated paths relative to it. */
function listFiles(dir: string, base = dir): string[] {
  let out: string[] = [];
  let names: string[] = [];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out = out.concat(listFiles(path, base));
    else out.push(relative(base, path).split("\\").join("/"));
  }
  return out;
}

/**
 * Writes `precache-manifest.js` next to the built app: every emitted asset and
 * public file, plus a version hash. `public/sw.js` imports it and precaches
 * the whole app on install, so Illigma opens with no network at all.
 */
function precacheManifest(): Plugin {
  let config: ResolvedConfig;
  const skip = new Set(["sw.js", "precache-manifest.js"]);
  return {
    name: "illigma-precache-manifest",
    apply: "build",
    enforce: "post",
    configResolved(c) {
      config = c;
    },
    generateBundle(_options, bundle) {
      const files = new Set<string>(["./"]);
      for (const name of Object.keys(bundle)) if (!skip.has(name) && !name.endsWith(".map")) files.add(name);
      for (const name of listFiles(config.publicDir)) if (!skip.has(name) && !name.startsWith(".")) files.add(name);
      const list = [...files].sort();
      const hash = createHash("sha256");
      for (const name of list) {
        const item = bundle[name];
        hash.update(name);
        if (item?.type === "chunk") hash.update(item.code);
        else if (item?.type === "asset") hash.update(typeof item.source === "string" ? item.source : Buffer.from(item.source));
        else if (name !== "./") hash.update(readFileSync(join(config.publicDir, name)));
      }
      const version = hash.digest("hex").slice(0, 12);
      this.emitFile({
        type: "asset",
        fileName: "precache-manifest.js",
        source: `// Generated at build time by vite.config.ts. Do not edit.\nself.__ILLIGMA_PRECACHE__ = ${JSON.stringify({ version, files: list }, null, 2)};\n`,
      });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), precacheManifest()],
  resolve: {
    alias: {
      "@illigma/format": src("format"),
      "@illigma/core": src("core"),
      "@illigma/renderer": src("renderer"),
      "@illigma/host-web": src("host-web"),
    },
  },
  build: { target: "es2022", sourcemap: true },
  server: { port: 5190 },
  preview: { port: 5191 },
});
