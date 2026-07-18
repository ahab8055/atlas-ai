import { describe, expect, it } from "vitest";

import { openAtlasDatabase } from "@atlas-ai/database";
import { generateAesGcmKey } from "@atlas-ai/security";

import { createLongTermMemory } from "../long-term/index.js";
import { createStaticDekProvider } from "../security/index.js";
import { createMemoryAnalyticsMonitor } from "./index.js";

describe("LongTermMemory analytics", () => {
  it("getStats reports store counts and open conflicts", () => {
    const db = openAtlasDatabase({ path: ":memory:", skipSeed: true });
    try {
      const analytics = createMemoryAnalyticsMonitor();
      const ltm = createLongTermMemory(db.memories, {
        dek: createStaticDekProvider(generateAesGcmKey()),
        analytics,
      });
      ltm.store({ type: "semantic", content: "Prefers TypeScript" });
      ltm.store({
        type: "semantic",
        content: "private note",
        sensitivity: "sensitive",
      });
      ltm.retrieve("TypeScript", { minScore: 0.05 });
      const stats = ltm.getStats();
      expect(stats.store.total).toBe(2);
      expect(stats.store.sensitive).toBe(1);
      expect(stats.store.encrypted).toBe(1);
      expect(stats.process.retrieval.count).toBe(1);
      expect(stats.openConflicts).toBe(0);
    } finally {
      db.close();
    }
  });

  it("records consolidation into process metrics", () => {
    const db = openAtlasDatabase({ path: ":memory:", skipSeed: true });
    try {
      const analytics = createMemoryAnalyticsMonitor();
      const ltm = createLongTermMemory(db.memories, { analytics });
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
      const result = ltm.consolidate({ type: "semantic" });
      expect(result.merged).toBeGreaterThanOrEqual(1);
      expect(ltm.getMetrics().merged).toBeGreaterThanOrEqual(1);
      expect(ltm.getMetrics().lastConsolidation?.merged).toBe(result.merged);
    } finally {
      db.close();
    }
  });
});
