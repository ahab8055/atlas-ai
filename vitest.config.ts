import { defineConfig } from "vitest/config";

// Unit/integration tests are colocated under packages and apps.
// Cross-cutting e2e lives under tests/e2e (Playwright later).
export default defineConfig({
  test: {
    name: "atlas-unit",
    environment: "node",
    include: [
      "packages/**/src/**/*.{test,spec}.ts",
      "apps/**/src/**/*.{test,spec}.{ts,tsx}",
      "tests/unit/**/*.{test,spec}.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/target/**",
      "tests/e2e/**",
    ],
    reporters: ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "coverage",
      include: ["packages/*/src/**/*.ts", "apps/*/src/**/*.{ts,tsx}"],
      exclude: [
        "**/*.{test,spec}.*",
        "**/dist/**",
        "packages/logging/src/node.ts",
      ],
    },
  },
});
