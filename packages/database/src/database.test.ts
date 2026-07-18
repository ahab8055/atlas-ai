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
      category: "tools",
      source: "manual",
    });
    expect(atlas.userPreferences.get("preferred_editor")).toBe("Cursor");
    expect(atlas.userPreferences.list().length).toBeGreaterThanOrEqual(3);
    expect(atlas.userPreferences.getRow("preferred_editor")?.source).toBe(
      "manual",
    );
    expect(atlas.userPreferences.setEnabled("theme", false)?.enabled).toBe(
      false,
    );
    expect(
      atlas.userPreferences.list({ enabledOnly: true }).every((r) => r.enabled),
    ).toBe(true);
    expect(atlas.userPreferences.delete("theme")).toBe(true);

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

  it("upserts and queries AI model registry rows", () => {
    const atlas = openAtlasDatabase({ path: ":memory:" });

    atlas.models.upsert({
      id: "phi-3-mini",
      name: "Phi-3 Mini",
      provider: "llamacpp",
      version: "3.0.0",
      format: "gguf",
      sizeBytes: 2_147_483_648,
      contextLength: 4096,
      capabilities: ["chat", "local"],
      requirements: { minRamGb: 8, acceleration: "cpu" },
      location: "/tmp/phi-3-mini.gguf",
      status: "available",
    });

    expect(atlas.models.get("phi-3-mini")?.name).toBe("Phi-3 Mini");
    expect(atlas.models.list({ format: "gguf" })).toHaveLength(1);
    expect(atlas.models.list({ capability: "chat" })[0]?.contextLength).toBe(
      4096,
    );
    expect(atlas.models.count()).toBe(1);
    expect(atlas.models.remove("phi-3-mini")).toBe(true);
    expect(atlas.models.count()).toBe(0);

    atlas.close();
  });

  it("stores embedding vectors for search/memory consumers", () => {
    const atlas = openAtlasDatabase({ path: ":memory:" });
    const embedding = Buffer.alloc(8);
    embedding.writeFloatLE(0.25, 0);
    embedding.writeFloatLE(-0.5, 4);

    const row = atlas.embeddings.upsert({
      content: "Atlas prefers local embeddings",
      embedding,
      dimensions: 2,
      modelId: "mock-embed-384",
      provider: "mock-embeddings",
      collection: "memory",
      source: "test",
      metadata: { kind: "note" },
    });

    expect(row.dimensions).toBe(2);
    expect(atlas.embeddings.list({ collection: "memory" })).toHaveLength(1);
    expect(atlas.embeddings.get(row.id)?.content).toContain("local embeddings");
    expect(atlas.embeddings.remove(row.id)).toBe(true);

    atlas.close();
  });

  it("persists long-term memories across reopen", () => {
    const path = join(tmpdir(), `atlas-memories-${Date.now()}.sqlite`);
    try {
      const atlas = openAtlasDatabase({ path });
      expect(atlas.schemaVersion).toBe(SCHEMA_VERSION);

      const stored = atlas.memories.upsert({
        type: "semantic",
        content: "User prefers TypeScript",
        importance: 0.9,
        tags: ["preference", "language"],
      });
      expect(stored.id).toBeTruthy();
      atlas.close();

      const again = openAtlasDatabase({ path });
      const loaded = again.memories.get(stored.id);
      expect(loaded?.content).toContain("TypeScript");
      expect(loaded?.tags).toEqual(["language", "preference"]);

      const ranked = again.memories.list({ text: "TypeScript", limit: 5 });
      expect(ranked[0]?.id).toBe(stored.id);

      again.memories.update(stored.id, {
        content: "User prefers TypeScript strictly",
      });
      expect(again.memories.get(stored.id)?.content).toContain("strictly");
      expect(again.memories.delete(stored.id)).toBe(true);
      expect(again.memories.get(stored.id)).toBeUndefined();
      again.close();
    } finally {
      rmSync(path, { force: true });
    }
  });

  it("aggregates memory store stats for diagnostics", () => {
    const atlas = openAtlasDatabase({ path: ":memory:", skipSeed: true });
    try {
      atlas.memories.upsert({
        type: "semantic",
        content: "aaa",
        sensitivity: "normal",
      });
      atlas.memories.upsert({
        type: "episodic",
        content: "bbbb",
        sensitivity: "sensitive",
        encrypted: true,
        contentNonce: "nonce",
      });
      atlas.memories.upsert({
        type: "semantic",
        content: "cc",
      });
      const stats = atlas.memories.stats();
      expect(stats.total).toBe(3);
      expect(stats.byType.semantic).toBe(2);
      expect(stats.byType.episodic).toBe(1);
      expect(stats.byType.procedural).toBe(0);
      expect(stats.sensitive).toBe(1);
      expect(stats.encrypted).toBe(1);
      expect(stats.contentBytes).toBe(3 + 4 + 2);
    } finally {
      atlas.close();
    }
  });

  it("persists knowledge graph entities and relationships", () => {
    const path = join(tmpdir(), `atlas-kg-${Date.now()}.sqlite`);
    try {
      const atlas = openAtlasDatabase({ path });
      expect(atlas.schemaVersion).toBe(SCHEMA_VERSION);

      const project = atlas.entities.upsert({
        type: "project",
        name: "Atlas",
        properties: { path: "/atlas" },
      });
      const tech = atlas.entities.upsert({
        type: "technology",
        name: "TypeScript",
      });
      const rel = atlas.relationships.upsert({
        fromEntityId: project.id,
        toEntityId: tech.id,
        type: "uses",
        weight: 0.9,
      });
      expect(rel.fromEntityId).toBe(project.id);
      atlas.close();

      const again = openAtlasDatabase({ path });
      expect(again.entities.get(project.id)?.name).toBe("Atlas");
      expect(again.relationships.get(rel.id)?.type).toBe("uses");

      const neighbors = again.relationships.neighbors(project.id, {
        direction: "out",
      });
      expect(neighbors).toHaveLength(1);
      expect(neighbors[0]?.entityId).toBe(tech.id);

      expect(again.entities.list({ type: "project" })).toHaveLength(1);
      expect(again.entities.delete(project.id)).toBe(true);
      expect(again.relationships.get(rel.id)).toBeUndefined();
      again.close();
    } finally {
      rmSync(path, { force: true });
    }
  });

  it("persists projects and associates memories with project_id", () => {
    const atlas = openAtlasDatabase({ path: ":memory:" });
    expect(atlas.schemaVersion).toBe(SCHEMA_VERSION);

    const project = atlas.projects.upsertByPath({
      name: "Atlas",
      path: "/tmp/atlas-ai",
      repoUrl: "https://github.com/example/atlas-ai.git",
      defaultBranch: "main",
    });
    expect(project.name).toBe("Atlas");
    expect(atlas.projects.getByPath("/tmp/atlas-ai")?.id).toBe(project.id);

    const mem = atlas.memories.upsert({
      type: "semantic",
      content: "Atlas uses TypeScript",
      projectId: project.id,
    });
    expect(mem.projectId).toBe(project.id);
    expect(
      atlas.memories.list({ projectIdOrUnscoped: project.id }),
    ).toHaveLength(1);

    atlas.close();
  });

  it("tracks preference observations and pending suggestions", () => {
    const atlas = openAtlasDatabase({ path: ":memory:" });
    expect(atlas.schemaVersion).toBe(SCHEMA_VERSION);

    const obs = atlas.preferenceObservations.increment({
      key: "preferred_editor",
      value: "Cursor",
      category: "tools",
      confidence: 0.7,
    });
    expect(obs.count).toBe(1);
    const again = atlas.preferenceObservations.increment({
      key: "preferred_editor",
      value: "Cursor",
      category: "tools",
      confidence: 0.8,
    });
    expect(again.count).toBe(2);

    const sug = atlas.preferenceSuggestions.upsertPending({
      key: "preferred_editor",
      value: "Cursor",
      category: "tools",
      confidence: 0.8,
      observationCount: 2,
      reason: "seen 2 times",
    });
    expect(sug.status).toBe("pending");
    expect(
      atlas.preferenceSuggestions.getPendingByKey("preferred_editor")?.id,
    ).toBe(sug.id);

    atlas.preferenceSuggestions.setStatus(sug.id, "approved");
    expect(atlas.preferenceSuggestions.get(sug.id)?.status).toBe("approved");

    atlas.close();
  });
});

describe("TaskHistoryService", () => {
  it("records completed tasks with timestamps, results, and failures", () => {
    const atlas = openAtlasDatabase({ path: ":memory:" });
    const startedAt = "2026-07-15T12:00:00.000Z";
    const finishedAt = "2026-07-15T12:00:01.000Z";

    const entry = atlas.taskHistory.record({
      taskId: "task-history-1",
      intent: "environment.setup",
      goal: "Prepare my development environment",
      status: "blocked",
      lifecycle: "failed",
      result: { summary: "Blocked: permissions" },
      failures: [
        {
          stepId: "open-editor",
          message: "Permission require_confirmation",
          code: "permission_blocked",
          at: finishedAt,
        },
      ],
      startedAt,
      finishedAt,
      steps: [
        {
          step: "open-editor",
          status: "blocked",
          error: "Permission require_confirmation",
        },
        { step: "start-backend", status: "skipped" },
      ],
    });

    expect(entry.timestamps.startedAt).toBe(startedAt);
    expect(entry.timestamps.finishedAt).toBe(finishedAt);
    expect(entry.result?.summary).toBe("Blocked: permissions");
    expect(entry.failures).toHaveLength(1);
    expect(entry.failures[0]?.code).toBe("permission_blocked");
    expect(entry.display.hasFailures).toBe(true);
    expect(entry.display.statusLabel).toBe("Blocked");
    expect(entry.display.headline).toContain("development environment");
    expect(entry.steps).toHaveLength(2);

    atlas.close();
  });

  it("supports querying history for UI / review", () => {
    const atlas = openAtlasDatabase({ path: ":memory:" });

    atlas.taskHistory.record({
      taskId: "t1",
      intent: "system.status",
      goal: "Status check",
      status: "completed",
      finishedAt: "2026-07-15T10:00:00.000Z",
      steps: [{ step: "status", status: "completed", result: "ok" }],
    });
    atlas.taskHistory.record({
      taskId: "t2",
      intent: "echo",
      goal: "Echo text",
      status: "completed",
      finishedAt: "2026-07-15T11:00:00.000Z",
      steps: [{ step: "echo", status: "completed", result: "hi" }],
    });
    atlas.taskHistory.record({
      taskId: "t3",
      intent: "application.open",
      goal: "Open VS Code",
      status: "blocked",
      finishedAt: "2026-07-15T12:00:00.000Z",
      failures: [{ message: "needs approval", code: "permission_blocked" }],
      steps: [{ step: "open", status: "blocked", error: "needs approval" }],
    });

    const blocked = atlas.taskHistory.query({ status: "blocked" });
    expect(blocked.total).toBe(1);
    expect(blocked.items[0]?.intent).toBe("application.open");
    expect(blocked.items[0]?.display.hasFailures).toBe(true);

    const byIntent = atlas.taskHistory.query({ intent: "echo" });
    expect(byIntent.total).toBe(1);
    expect(byIntent.items[0]?.title).toBe("Echo text");

    const recent = atlas.taskHistory.listRecent(2);
    expect(recent).toHaveLength(2);
    expect(recent[0]?.taskId).toBe("t3");

    const detail = atlas.taskHistory.getById(recent[0]!.id);
    expect(detail?.steps[0]?.name).toBe("open");
    expect(detail?.display.headline).toBeTruthy();
    expect(detail?.timestamps.createdAt).toBeTruthy();

    atlas.close();
  });
});
