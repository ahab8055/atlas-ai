import { describe, expect, it } from "vitest";
import { openAtlasDatabase } from "@atlas-ai/database";

import { formatRecentFiles, parseRecentCommand } from "./recent.js";

describe("parseRecentCommand", () => {
  it("parses recent with filters", () => {
    expect(parseRecentCommand("history")).toBeNull();
    const parsed = parseRecentCommand(
      "recent --limit 5 --sort frequent --prefix /workspace/ --action read --since 2026-01-01T00:00:00.000Z",
    );
    expect(parsed?.query).toEqual({
      limit: 5,
      sort: "frequent",
      pathPrefix: "/workspace/",
      action: "read",
      since: "2026-01-01T00:00:00.000Z",
    });
  });
});

describe("formatRecentFiles", () => {
  it("renders recent file rows for the terminal", () => {
    const db = openAtlasDatabase({ path: ":memory:" });
    db.recentFiles.touch({
      path: "/workspace/a.ts",
      action: "read",
      at: "2026-01-01T12:00:00.000Z",
    });
    db.recentFiles.touch({
      path: "/workspace/a.ts",
      action: "write",
      at: "2026-01-01T13:00:00.000Z",
    });

    const text = formatRecentFiles(db, { limit: 10 });
    expect(text).toContain("path\tcount\taction\tlast_accessed_at");
    expect(text).toContain("/workspace/a.ts");
    expect(text).toContain("2");
    expect(text).toContain("write");
    db.close();
  });
});
