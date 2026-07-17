import { describe, expect, it } from "vitest";

import { openAtlasDatabase } from "@atlas-ai/database";

import {
  createLongTermMemory,
  detectContradiction,
  pairSimilarity,
  readConflict,
  readHistory,
} from "../index.js";

describe("consolidation heuristics", () => {
  it("detects opposing theme preferences as contradictions", () => {
    expect(
      detectContradiction(
        "User prefers dark mode interfaces",
        "User prefers light mode interfaces",
      ),
    ).toBe(true);
  });

  it("treats editor preference changes as supersedes not conflicts", () => {
    expect(
      detectContradiction(
        "Preferred editor is VS Code",
        "Preferred editor is Cursor",
      ),
    ).toBe(false);
  });

  it("scores near-identical text highly", () => {
    const score = pairSimilarity(
      "User prefers dark mode interfaces",
      "User prefers dark mode interfaces",
    );
    expect(score).toBeGreaterThan(0.9);
  });
});

describe("LongTermMemory.consolidate", () => {
  it("merges duplicate memories and preserves history", () => {
    const db = openAtlasDatabase({ path: ":memory:" });
    try {
      const ltm = createLongTermMemory(db.memories);
      ltm.store({
        type: "semantic",
        content: "User prefers dark mode interfaces",
        importance: 0.8,
        confidence: 0.8,
      });
      ltm.store({
        type: "semantic",
        content: "User prefers dark mode interfaces",
        importance: 0.7,
        confidence: 0.7,
      });

      expect(ltm.list().length).toBe(2);
      const result = ltm.consolidate({ type: "semantic" });
      expect(result.merged).toBeGreaterThanOrEqual(1);
      expect(ltm.list().length).toBe(1);

      const survivor = ltm.list()[0]!;
      const history = readHistory(survivor.metadata);
      expect(
        history.length > 0 ||
          (survivor.metadata?.consolidatedFrom as string[] | undefined)?.length,
      ).toBeTruthy();
    } finally {
      db.close();
    }
  });

  it("updates editor preference and keeps history (VS Code → Cursor)", () => {
    const db = openAtlasDatabase({ path: ":memory:" });
    try {
      const ltm = createLongTermMemory(db.memories);
      ltm.store({
        type: "semantic",
        content: "I prefer the VS Code editor",
        importance: 0.8,
        confidence: 0.8,
      });

      const result = ltm.evaluateAndStore("I prefer the Cursor editor", {
        consolidateOnStore: true,
        consolidation: {
          mergeMinScore: 0.5,
          conflictMinScore: 0.4,
          candidateLimit: 10,
          consolidateOnStore: true,
        },
      });

      expect(result.stored).toBe(true);
      expect(result.consolidation?.action).toBe("merge");
      expect(ltm.list().length).toBe(1);
      expect(ltm.list()[0]?.content.toLowerCase()).toContain("cursor");
      const history = readHistory(ltm.list()[0]?.metadata);
      expect(history.some((h) => /vs\s*code/i.test(h.content))).toBe(true);
    } finally {
      db.close();
    }
  });

  it("flags dark vs light mode as open conflicts", () => {
    const db = openAtlasDatabase({ path: ":memory:" });
    try {
      const ltm = createLongTermMemory(db.memories);
      ltm.store({
        type: "semantic",
        content: "User prefers dark mode",
        importance: 0.9,
        confidence: 0.9,
      });
      ltm.store({
        type: "semantic",
        content: "User prefers light mode",
        importance: 0.9,
        confidence: 0.9,
      });

      const result = ltm.consolidate({
        type: "semantic",
        thresholds: {
          mergeMinScore: 0.95,
          conflictMinScore: 0.3,
        },
      });

      expect(result.conflicts).toBeGreaterThanOrEqual(1);
      expect(ltm.list().length).toBe(2);
      const conflicts = ltm.listConflicts();
      expect(conflicts.length).toBeGreaterThanOrEqual(1);
      expect(readConflict(conflicts[0]?.metadata)?.status).toBe("open");
    } finally {
      db.close();
    }
  });

  it("dry-run does not delete duplicates", () => {
    const db = openAtlasDatabase({ path: ":memory:" });
    try {
      const ltm = createLongTermMemory(db.memories);
      ltm.store({
        type: "semantic",
        content: "Prefers TypeScript strictly",
        importance: 0.9,
      });
      ltm.store({
        type: "semantic",
        content: "Prefers TypeScript strictly",
        importance: 0.8,
      });
      const result = ltm.consolidate({ dryRun: true, type: "semantic" });
      expect(result.merged).toBeGreaterThanOrEqual(1);
      expect(ltm.list().length).toBe(2);
    } finally {
      db.close();
    }
  });
});
