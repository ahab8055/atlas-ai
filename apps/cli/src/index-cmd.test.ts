import { describe, expect, it } from "vitest";

import {
  formatIndexBuild,
  formatIndexSearch,
  formatIndexStatus,
  parseIndexCommand,
} from "./index-cmd.js";

describe("parseIndexCommand", () => {
  it("parses build, status, and search", () => {
    expect(parseIndexCommand("recent")).toBeNull();
    expect(parseIndexCommand("index build --cwd /tmp")).toEqual({
      kind: "build",
      cwd: "/tmp",
    });
    expect(parseIndexCommand("index status")).toEqual({ kind: "status" });
    expect(parseIndexCommand("index search hello world --limit 5")).toEqual({
      kind: "search",
      query: "hello world",
      limit: 5,
    });
  });
});

describe("formatIndex*", () => {
  it("formats build and status and search", () => {
    expect(
      formatIndexBuild({
        scanned: 3,
        indexed: 2,
        skipped: 1,
        errors: 0,
        unchanged: 0,
      }),
    ).toContain("scanned=3");
    expect(
      formatIndexStatus({
        total: 2,
        indexed: 2,
        skipped: 0,
        error: 0,
        pending: 0,
        lastIndexedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toContain("indexed=2");
    expect(
      formatIndexSearch([
        { path: "/a.ts", name: "a.ts", rank: -1.2, snippet: "hello" },
      ]),
    ).toContain("/a.ts");
  });
});
