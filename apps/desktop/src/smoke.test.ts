import { describe, expect, it } from "vitest";

/**
 * Placeholder app-level test so the desktop package is included in the
 * Vitest discovery path. Prefer Testing Library once UI grows.
 */
describe("desktop package", () => {
  it("is present in the workspace test graph", () => {
    expect(true).toBe(true);
  });
});
