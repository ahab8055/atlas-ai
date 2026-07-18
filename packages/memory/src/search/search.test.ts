import { describe, expect, it } from "vitest";

import { openAtlasDatabase } from "@atlas-ai/database";

import { createLongTermMemory } from "../long-term/index.js";
import { createMemorySearchApi, weightsForMode } from "./api.js";

describe("MemorySearchApi", () => {
  it("records tookMs and returns empty for blank query", () => {
    const db = openAtlasDatabase({ path: ":memory:", skipSeed: true });
    try {
      const api = createMemorySearchApi(db.memories);
      const result = api.search({ query: "   " });
      expect(result.hits).toEqual([]);
      expect(result.mode).toBe("hybrid");
      expect(result.tookMs).toBeGreaterThanOrEqual(0);
    } finally {
      db.close();
    }
  });

  it("keyword mode prefers lexical overlap over unrelated semantic hash", () => {
    const db = openAtlasDatabase({ path: ":memory:", skipSeed: true });
    try {
      const ltm = createLongTermMemory(db.memories);
      ltm.store({
        type: "semantic",
        content: "uniquekeyword zebra alpha",
        importance: 0.2,
        confidence: 0.2,
      });
      ltm.store({
        type: "semantic",
        content: "totally unrelated gardening tips",
        importance: 0.9,
        confidence: 0.9,
      });

      const api = createMemorySearchApi(db.memories);
      const keyword = api.search({
        query: "uniquekeyword zebra",
        mode: "keyword",
        limit: 5,
        minScore: 0.05,
      });
      expect(keyword.mode).toBe("keyword");
      expect(keyword.hits[0]?.record.content).toContain("uniquekeyword");
    } finally {
      db.close();
    }
  });

  it("filters by type, tags, sessionId, and projectId", () => {
    const db = openAtlasDatabase({ path: ":memory:", skipSeed: true });
    try {
      const project = db.projects.upsertByPath({
        name: "demo",
        path: "/tmp/demo-search",
      });
      const ltm = createLongTermMemory(db.memories);
      ltm.store({
        type: "semantic",
        content: "TypeScript preference for Atlas search",
        tags: ["lang"],
        sessionId: "sess-a",
        projectId: project.id,
        importance: 0.8,
      });
      ltm.store({
        type: "episodic",
        content: "TypeScript preference for Atlas search",
        tags: ["other"],
        sessionId: "sess-b",
        importance: 0.8,
      });

      const api = createMemorySearchApi(db.memories);
      const bySession = api.search({
        query: "TypeScript Atlas",
        sessionId: "sess-a",
        minScore: 0.05,
      });
      expect(bySession.hits.every((h) => h.record.sessionId === "sess-a")).toBe(
        true,
      );

      const byTag = api.search({
        query: "TypeScript Atlas",
        tags: ["lang"],
        minScore: 0.05,
      });
      expect(byTag.hits.every((h) => h.record.tags?.includes("lang"))).toBe(
        true,
      );

      const byType = api.search({
        query: "TypeScript Atlas",
        type: "semantic",
        minScore: 0.05,
      });
      expect(byType.hits.every((h) => h.record.type === "semantic")).toBe(true);

      const byProject = api.search({
        query: "TypeScript Atlas",
        projectId: project.id,
        minScore: 0.05,
      });
      expect(
        byProject.hits.every(
          (h) =>
            h.record.projectId === project.id || h.record.projectId == null,
        ),
      ).toBe(true);
    } finally {
      db.close();
    }
  });

  it("weightsForMode returns distinct presets", () => {
    expect(weightsForMode("keyword").lexical).toBeGreaterThan(
      weightsForMode("keyword").semantic,
    );
    expect(weightsForMode("semantic").semantic).toBeGreaterThan(
      weightsForMode("semantic").lexical,
    );
    expect(weightsForMode("hybrid").semantic).toBe(0.4);
  });

  it("completes under 500ms for a small corpus", () => {
    const db = openAtlasDatabase({ path: ":memory:", skipSeed: true });
    try {
      const ltm = createLongTermMemory(db.memories);
      for (let i = 0; i < 40; i += 1) {
        ltm.store({
          type: "semantic",
          content: `Fact ${i} about atlas memory search api`,
          importance: 0.5,
        });
      }
      const api = createMemorySearchApi(db.memories);
      const result = api.search({
        query: "atlas memory search",
        mode: "hybrid",
        limit: 5,
      });
      expect(result.hits.length).toBeGreaterThan(0);
      expect(result.tookMs).toBeLessThan(500);
    } finally {
      db.close();
    }
  });
});
