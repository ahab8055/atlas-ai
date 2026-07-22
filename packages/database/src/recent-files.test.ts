import { describe, expect, it } from "vitest";

import { openAtlasDatabase } from "./index.js";

describe("RecentFilesRepository", () => {
  it("touches, increments count, lists by recent/frequent, filters, and removes", () => {
    const atlas = openAtlasDatabase({ path: ":memory:" });

    const first = atlas.recentFiles.touch({
      path: "/workspace/a.ts",
      action: "read",
      at: "2026-01-01T10:00:00.000Z",
    });
    expect(first.accessCount).toBe(1);
    expect(first.lastAction).toBe("read");

    const second = atlas.recentFiles.touch({
      path: "/workspace/a.ts",
      action: "write",
      at: "2026-01-01T12:00:00.000Z",
    });
    expect(second.accessCount).toBe(2);
    expect(second.lastAction).toBe("write");
    expect(second.lastAccessedAt).toBe("2026-01-01T12:00:00.000Z");

    atlas.recentFiles.touch({
      path: "/workspace/b.ts",
      action: "read",
      at: "2026-01-01T11:00:00.000Z",
    });
    atlas.recentFiles.touch({
      path: "/other/c.ts",
      action: "write",
      at: "2026-01-01T13:00:00.000Z",
    });
    atlas.recentFiles.touch({
      path: "/other/c.ts",
      action: "write",
      at: "2026-01-01T14:00:00.000Z",
    });
    atlas.recentFiles.touch({
      path: "/other/c.ts",
      action: "write",
      at: "2026-01-01T15:00:00.000Z",
    });

    const byRecent = atlas.recentFiles.list({ sort: "recent", limit: 10 });
    expect(byRecent.map((r) => r.path)).toEqual([
      "/other/c.ts",
      "/workspace/a.ts",
      "/workspace/b.ts",
    ]);

    const byFrequent = atlas.recentFiles.list({ sort: "frequent", limit: 10 });
    expect(byFrequent[0]?.path).toBe("/other/c.ts");
    expect(byFrequent[0]?.accessCount).toBe(3);

    const prefixed = atlas.recentFiles.list({ pathPrefix: "/workspace/" });
    expect(prefixed).toHaveLength(2);
    expect(prefixed.every((r) => r.path.startsWith("/workspace/"))).toBe(true);

    const writes = atlas.recentFiles.list({ action: "write" });
    expect(writes.map((r) => r.path).sort()).toEqual([
      "/other/c.ts",
      "/workspace/a.ts",
    ]);

    const since = atlas.recentFiles.list({
      since: "2026-01-01T13:00:00.000Z",
    });
    expect(since.map((r) => r.path)).toEqual(["/other/c.ts"]);

    expect(atlas.recentFiles.remove("/workspace/b.ts")).toBe(true);
    expect(atlas.recentFiles.getByPath("/workspace/b.ts")).toBeUndefined();
    expect(atlas.recentFiles.clear()).toBe(2);

    atlas.close();
  });
});
