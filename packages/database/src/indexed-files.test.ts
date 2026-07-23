import { describe, expect, it } from "vitest";

import { openAtlasDatabase } from "./index.js";

describe("IndexedFilesRepository", () => {
  it("upserts metadata, searches FTS, and removes by path/prefix", () => {
    const atlas = openAtlasDatabase({ path: ":memory:" });

    atlas.indexedFiles.upsertWithContent({
      path: "/workspace/src/app.ts",
      name: "app.ts",
      extension: ".ts",
      size: 42,
      mtimeMs: 1000,
      contentHash: "hash1",
      content: "export function greet() { return 'hello atlas'; }",
      status: "indexed",
    });

    const hit = atlas.indexedFiles.searchFts({ query: "greet atlas" });
    expect(hit.length).toBeGreaterThan(0);
    expect(hit[0]?.path).toBe("/workspace/src/app.ts");

    const same = atlas.indexedFiles.getByPath("/workspace/src/app.ts");
    expect(same?.contentHash).toBe("hash1");

    atlas.indexedFiles.upsertWithContent({
      path: "/workspace/docs/readme.md",
      name: "readme.md",
      extension: ".md",
      contentHash: "hash2",
      content: "Atlas documentation",
      status: "indexed",
    });

    expect(atlas.indexedFiles.remove("/workspace/src/app.ts")).toBe(true);
    expect(atlas.indexedFiles.searchFts({ query: "greet" })).toHaveLength(0);

    atlas.indexedFiles.upsertWithContent({
      path: "/workspace/pkg/a.ts",
      name: "a.ts",
      content: "alpha",
      contentHash: "a",
    });
    atlas.indexedFiles.upsertWithContent({
      path: "/workspace/pkg/b.ts",
      name: "b.ts",
      content: "beta",
      contentHash: "b",
    });
    expect(atlas.indexedFiles.removeByPrefix("/workspace/pkg")).toBe(2);

    const summary = atlas.indexedFiles.statusSummary();
    expect(summary.indexed).toBe(1);
    expect(summary.total).toBe(1);

    atlas.close();
  });
});
