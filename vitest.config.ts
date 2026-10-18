import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (pkg: string) => fileURLToPath(new URL(`./packages/${pkg}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    // Tests run against source, so packages don't need building first.
    alias: { "@illigma/format": src("format"), "@illigma/core": src("core"), "@illigma/tokens": src("tokens") },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"],
  },
});
