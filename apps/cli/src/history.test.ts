import { describe, expect, it } from "vitest";
import { openAtlasDatabase } from "@atlas-ai/database";

import { formatTaskHistory, parseHistoryCommand } from "./history.js";

describe("parseHistoryCommand", () => {
  it("parses history with filters", () => {
    expect(parseHistoryCommand("status")).toBeNull();
    const parsed = parseHistoryCommand(
      "history --status failed --limit 5 --intent echo",
    );
    expect(parsed?.query).toEqual({
      limit: 5,
      includeSteps: true,
      status: "failed",
      intent: "echo",
    });
  });
});

describe("formatTaskHistory", () => {
  it("renders UI-shaped history entries for the terminal", () => {
    const db = openAtlasDatabase({ path: ":memory:" });
    db.taskHistory.record({
      taskId: "t1",
      intent: "system.status",
      goal: "Report Atlas runtime status",
      status: "completed",
      finishedAt: "2026-07-15T12:00:00.000Z",
      steps: [{ step: "status", status: "completed", result: "ok" }],
    });

    const text = formatTaskHistory(db, { limit: 10 });
    expect(text).toContain("Task history");
    expect(text).toContain("Completed");
    expect(text).toContain("Report Atlas runtime status");
    db.close();
  });
});
