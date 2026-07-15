import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { openAtlasDatabase, SCHEMA_VERSION } from "./index.js";

describe("AtlasDatabase", () => {
  it("initializes automatically in memory and seeds system settings", () => {
    const atlas = openAtlasDatabase({ path: ":memory:" });

    expect(atlas.schemaVersion).toBe(SCHEMA_VERSION);
    expect(atlas.systemConfig.get("app.name")).toBe("Atlas AI");
    expect(atlas.systemConfig.get("runtime.initialized")).toBe("true");
    expect(atlas.userPreferences.get("preferred_editor")).toBe("VS Code");
    expect(atlas.userPreferences.get("theme")).toBe("system");

    atlas.close();
  });

  it("stores and retrieves system config and preferences", () => {
    const atlas = openAtlasDatabase({ path: ":memory:" });

    atlas.systemConfig.set("logging.level", "debug");
    expect(atlas.systemConfig.get("logging.level")).toBe("debug");

    atlas.userPreferences.set("preferred_editor", "Cursor", {
      category: "editor",
    });
    expect(atlas.userPreferences.get("preferred_editor")).toBe("Cursor");
    expect(atlas.userPreferences.list().length).toBeGreaterThanOrEqual(3);

    atlas.close();
  });

  it("upserts tool registry rows and lists them", () => {
    const atlas = openAtlasDatabase({ path: ":memory:" });

    atlas.tools.upsert({
      name: "echo",
      description: "Echo text",
      version: "1.0.0",
      risk: "low",
    });
    atlas.tools.upsert({
      name: "echo",
      description: "Echo text (updated)",
      version: "1.0.1",
      risk: "low",
    });

    const tools = atlas.tools.list();
    expect(tools).toHaveLength(1);
    expect(tools[0]?.description).toContain("updated");
    expect(tools[0]?.version).toBe("1.0.1");

    atlas.close();
  });

  it("records execution history and task steps", () => {
    const atlas = openAtlasDatabase({ path: ":memory:" });

    const recorded = atlas.executionHistory.record({
      taskId: "task-1",
      planId: "plan-1",
      requestId: "req-1",
      traceId: "trace-1",
      intent: "system.status",
      goal: "status",
      status: "completed",
      lifecycle: "completed",
      progress: { percent: 100 },
      result: { ok: true },
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      steps: [
        {
          step: "status",
          status: "completed",
          result: "Atlas core OK",
        },
      ],
    });

    expect(recorded.id).toMatch(/^exec_/);
    expect(atlas.executionHistory.listRecent(5)).toHaveLength(1);
    const steps = atlas.executionHistory.listSteps(recorded.id);
    expect(steps).toHaveLength(1);
    expect(steps[0]?.step).toBe("status");

    atlas.close();
  });

  it("creates a file database under a temp directory", () => {
    const dir = mkdtempSync(join(tmpdir(), "atlas-db-"));
    const path = join(dir, "atlas.sqlite");
    try {
      const atlas = openAtlasDatabase({ path });
      expect(atlas.path).toBe(path);
      expect(atlas.systemConfig.get("app.name")).toBe("Atlas AI");
      atlas.close();

      const reopened = openAtlasDatabase({ path });
      expect(reopened.systemConfig.get("app.name")).toBe("Atlas AI");
      reopened.systemConfig.set("custom.key", "persisted");
      reopened.close();

      const again = openAtlasDatabase({ path });
      expect(again.systemConfig.get("custom.key")).toBe("persisted");
      again.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
