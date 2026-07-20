import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

/**
 * Platform-only coverage gate (ADR-0072).
 * Run: pnpm --filter @atlas-ai/platform test:coverage
 */
export default defineConfig({
  resolve: {
    alias: {
      "@atlas-ai/logging": path.join(root, "packages/logging/dist/index.js"),
      "@atlas-ai/security": path.join(root, "packages/security/dist/index.js"),
      "@atlas-ai/config": path.join(root, "packages/config/dist/index.js"),
      "@atlas-ai/platform": path.join(root, "packages/platform/src/index.ts"),
    },
  },
  test: {
    name: "platform",
    environment: "node",
    root,
    include: ["packages/platform/src/**/*.{test,spec}.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: path.join(root, "coverage/platform"),
      include: ["packages/platform/src/**/*.ts"],
      exclude: [
        "**/*.{test,spec}.*",
        "**/dist/**",
        // Real spawn wrappers — unit tests use injectable mock runners (ADR-0072)
        "**/runner.ts",
        // Type-only module
        "**/types.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
