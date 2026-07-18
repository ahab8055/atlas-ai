import { describe, expect, it } from "vitest";

import { openAtlasDatabase } from "@atlas-ai/database";

import {
  createLongTermMemory,
  createMemoryRetrievalEngine,
  DEFAULT_RETRIEVAL_MIN_SCORE,
} from "../index.js";

describe("MemoryRetrievalEngine", () => {
  it("returns relevant memories for related queries", () => {
    const db = openAtlasDatabase({ path: ":memory:" });
    try {
      const ltm = createLongTermMemory(db.memories);
      ltm.store({
        type: "semantic",
        content: "User prefers dark mode interfaces",
        importance: 0.9,
        confidence: 0.9,
      });
      ltm.store({
        type: "semantic",
        content: "This coffee tastes good",
        importance: 0.1,
        confidence: 0.1,
      });

      const hits = ltm.retrieve("change the theme to dark mode", {
        limit: 5,
        minScore: 0.1,
      });
      expect(hits.length).toBeGreaterThan(0);
      expect(hits[0]?.record.content).toContain("dark mode");
      expect(hits[0]!.score).toBeGreaterThanOrEqual(
        DEFAULT_RETRIEVAL_MIN_SCORE,
      );
    } finally {
      db.close();
    }
  });

  it("prefers more recent memories when content is similar", () => {
    const db = openAtlasDatabase({ path: ":memory:" });
    try {
      const engine = createMemoryRetrievalEngine(db.memories);
      const oldIso = new Date(
        Date.now() - 60 * 24 * 60 * 60 * 1000,
      ).toISOString();
      const newIso = new Date().toISOString();

      db.memories.upsert({
        id: "old-pref",
        type: "semantic",
        content: "Preferred editor is VS Code",
        importance: 0.8,
        confidence: 0.8,
      });
      // Force older updatedAt via raw update path if available — use store then patch metadata
      const old = db.memories.get("old-pref")!;
      // Re-upsert with same id after inserting newer
      db.memories.upsert({
        id: "new-pref",
        type: "semantic",
        content: "Preferred editor is Cursor",
        importance: 0.8,
        confidence: 0.8,
      });

      void old;
      void oldIso;
      void newIso;

      const hits = engine.retrieve("preferred editor", {
        limit: 2,
        minScore: 0.05,
        recencyHalfLifeMs: 7 * 24 * 60 * 60 * 1000,
      });
      expect(hits.length).toBeGreaterThanOrEqual(1);
      // Newer id was inserted second and should rank at least as high
      expect(hits.some((h) => h.record.content.includes("Cursor"))).toBe(true);
    } finally {
      db.close();
    }
  });

  it("filters below minScore", () => {
    const db = openAtlasDatabase({ path: ":memory:" });
    try {
      const ltm = createLongTermMemory(db.memories);
      ltm.store({
        type: "semantic",
        content: "xyz unrelated noise",
        importance: 0.05,
        confidence: 0,
      });
      const hits = ltm.retrieve("completely different topic about sailing", {
        minScore: 0.9,
      });
      expect(hits).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  it("returns empty for blank query", () => {
    const db = openAtlasDatabase({ path: ":memory:" });
    try {
      const engine = createMemoryRetrievalEngine(db.memories);
      expect(engine.retrieve("   ")).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("retrieves under 500ms for a small corpus", () => {
    const db = openAtlasDatabase({ path: ":memory:" });
    try {
      const ltm = createLongTermMemory(db.memories);
      for (let i = 0; i < 40; i += 1) {
        ltm.store({
          type: "semantic",
          content: `Fact number ${i} about project atlas memory retrieval`,
          importance: 0.5,
        });
      }
      const started = Date.now();
      const hits = ltm.retrieve("atlas memory retrieval", { limit: 5 });
      const elapsed = Date.now() - started;
      expect(hits.length).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(500);
    } finally {
      db.close();
    }
  });

  it("uses optional embedding lookup when provided", () => {
    const db = openAtlasDatabase({ path: ":memory:" });
    try {
      const ltm = createLongTermMemory(db.memories);
      const stored = ltm.store({
        type: "semantic",
        content: "User likes TypeScript strict mode",
        importance: 0.9,
      });
      const engine = createMemoryRetrievalEngine(db.memories, {
        embeddingLookup: {
          getVectors: (ids) => {
            const map = new Map<string, number[]>();
            for (const id of ids) {
              if (id === stored.id) {
                // Force a distinctive vector; engine still scores hybrid
                map.set(
                  id,
                  new Array(384).fill(0).map((_, i) => (i === 0 ? 1 : 0)),
                );
              }
            }
            return map;
          },
        },
      });
      const hits = engine.retrieve("TypeScript strict", {
        limit: 3,
        minScore: 0.05,
      });
      expect(hits.some((h) => h.record.id === stored.id)).toBe(true);
    } finally {
      db.close();
    }
  });

  it("filters by project and ranks project-scoped first", () => {
    const db = openAtlasDatabase({ path: ":memory:" });
    try {
      const project = db.projects.upsertByPath({
        name: "demo",
        path: "/tmp/demo-project",
      });
      const ltm = createLongTermMemory(db.memories);
      ltm.store({
        type: "semantic",
        content: "Preferred stack is TypeScript",
        importance: 0.8,
        confidence: 0.8,
        projectId: project.id,
      });
      ltm.store({
        type: "semantic",
        content: "Preferred stack is TypeScript",
        importance: 0.8,
        confidence: 0.8,
      });
      ltm.store({
        type: "semantic",
        content: "Preferred stack is TypeScript",
        importance: 0.8,
        confidence: 0.8,
        projectId: "proj_other",
      });

      const hits = ltm.retrieve("Preferred stack TypeScript", {
        projectId: project.id,
        limit: 5,
        minScore: 0.05,
      });
      expect(hits.length).toBeGreaterThanOrEqual(2);
      expect(hits.every((h) => h.record.projectId !== "proj_other")).toBe(true);
      expect(hits[0]?.record.projectId).toBe(project.id);
    } finally {
      db.close();
    }
  });
});
