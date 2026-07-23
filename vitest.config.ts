import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

/** Root `tests/integration` imports workspace packages via aliases (not hoisted to root). */
const workspaceAlias = {
  "@atlas-ai/core": path.join(root, "packages/core/dist/index.js"),
  "@atlas-ai/ai": path.join(root, "packages/ai/dist/index.js"),
  "@atlas-ai/logging": path.join(root, "packages/logging/dist/index.js"),
  "@atlas-ai/security": path.join(root, "packages/security/dist/index.js"),
  "@atlas-ai/tools": path.join(root, "packages/tools/dist/index.js"),
  "@atlas-ai/memory": path.join(root, "packages/memory/dist/index.js"),
  "@atlas-ai/knowledge": path.join(root, "packages/knowledge/dist/index.js"),
  "@atlas-ai/profile": path.join(root, "packages/profile/dist/index.js"),
  "@atlas-ai/workspace": path.join(root, "packages/workspace/dist/index.js"),
  "@atlas-ai/search": path.join(root, "packages/search/dist/index.js"),
  "@atlas-ai/platform": path.join(root, "packages/platform/dist/index.js"),
  "@atlas-ai/filesystem": path.join(root, "packages/filesystem/dist/index.js"),
  "@atlas-ai/database": path.join(root, "packages/database/dist/index.js"),
  "@atlas-ai/config": path.join(root, "packages/config/dist/index.js"),
};

// Unit tests are colocated under packages and apps.
// Cross-package Phase 1 integration: tests/integration.
// Cross-cutting e2e lives under tests/e2e (Playwright later).
export default defineConfig({
  resolve: {
    alias: workspaceAlias,
  },
  test: {
    name: "atlas",
    environment: "node",
    include: [
      "packages/**/src/**/*.{test,spec}.ts",
      "apps/**/src/**/*.{test,spec}.{ts,tsx}",
      "tests/unit/**/*.{test,spec}.ts",
      "tests/integration/**/*.{test,spec}.ts",
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
