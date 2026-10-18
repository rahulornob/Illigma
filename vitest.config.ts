import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (pkg: string) => fileURLToPath(new URL(`./packages/${pkg}/src/index.ts`, import.meta.url));

export default defineConfig({
  resolve: {
    // Tests run against source, so packages don't need building first.
    alias: {
      "@illigma/format": src("format"),
      "@illigma/core": src("core"),
      "@illigma/layout": src("layout"),
      "@illigma/tokens": src("tokens"),
      "@illigma/renderer": src("renderer"),
      "@illigma/export": src("export"),
      // Sub-path first: Vite matches aliases by prefix, in order.
      "@illigma/host-web/testing": fileURLToPath(new URL("./packages/host-web/src/testing/fake-fs.ts", import.meta.url)),
      "@illigma/host-web": src("host-web"),
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"],
    // Shared CI runners are slower than a laptop; time budgets in tests scale the same way (PERF_BUDGET_SCALE).
    testTimeout: process.env.CI ? 30_000 : 5_000,
  },
});
