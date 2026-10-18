import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const src = (pkg: string) => fileURLToPath(new URL(`../../packages/${pkg}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@illigma/format": src("format"),
      "@illigma/core": src("core"),
      "@illigma/renderer": src("renderer"),
    },
  },
  server: { port: 5180 },
});
