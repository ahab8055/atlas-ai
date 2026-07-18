import { describe, expect, it } from "vitest";

import {
  createMemoryAnalyticsMonitor,
  formatMemoryStats,
  type MemoryStatsReport,
} from "./index.js";

describe("MemoryAnalyticsMonitor", () => {
  it("aggregates retrieval timing and flags slow samples", () => {
    const monitor = createMemoryAnalyticsMonitor({
      slowRetrievalMs: 500,
      createEventId: (() => {
        let n = 0;
        return () => `e${++n}`;
      })(),
    });
    monitor.recordRetrieval({ tookMs: 10, hits: 2, mode: "hybrid" });
    monitor.recordRetrieval({ tookMs: 600, hits: 1, mode: "keyword" });
    const metrics = monitor.getMetrics();
    expect(metrics.retrieval.count).toBe(2);
    expect(metrics.retrieval.minMs).toBe(10);
    expect(metrics.retrieval.maxMs).toBe(600);
    expect(metrics.retrieval.avgMs).toBe(305);
    expect(metrics.slowRetrievals).toBe(1);
    expect(metrics.recentRetrievals).toHaveLength(2);
  });

  it("records consolidation counters", () => {
    const monitor = createMemoryAnalyticsMonitor();
    monitor.recordConsolidation({
      scanned: 10,
      merged: 2,
      conflicts: 1,
      skipped: 3,
      pairs: [],
    });
    const metrics = monitor.getMetrics();
    expect(metrics.consolidationsRun).toBe(1);
    expect(metrics.merged).toBe(2);
    expect(metrics.conflictsFlagged).toBe(1);
    expect(metrics.skipped).toBe(3);
    expect(metrics.lastConsolidation?.scanned).toBe(10);
  });

  it("formats a stats report for CLI", () => {
    const monitor = createMemoryAnalyticsMonitor();
    monitor.recordRetrieval({ tookMs: 12, hits: 1 });
    const report: MemoryStatsReport = {
      updatedAt: "2026-07-18T00:00:00.000Z",
      store: {
        total: 3,
        byType: { episodic: 1, semantic: 2, procedural: 0 },
        sensitive: 1,
        encrypted: 1,
        contentBytes: 100,
      },
      openConflicts: 0,
      process: monitor.getMetrics(),
    };
    const text = formatMemoryStats(report);
    expect(text).toContain("total=3");
    expect(text).toContain("contentBytes=100");
    expect(text).toContain("timing: n=1");
  });
});
