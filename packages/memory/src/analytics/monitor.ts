/**
 * In-process memory analytics monitor (ADR-0058).
 */
import type { ConsolidationResult } from "../consolidation/index.js";
import {
  DEFAULT_SLOW_RETRIEVAL_MS,
  type ConsolidationSnapshot,
  type MemoryAnalyticsMonitorOptions,
  type MemoryProcessMetrics,
  type MemoryRetrievalSample,
  type TimingStats,
} from "./types.js";

const DEFAULT_MAX_EVENTS = 50;

function emptyTiming(): TimingStats {
  return { count: 0, totalMs: 0, avgMs: 0, minMs: 0, maxMs: 0 };
}

function pushTiming(stats: TimingStats, durationMs: number): TimingStats {
  const ms = Math.max(0, durationMs);
  const count = stats.count + 1;
  const totalMs = stats.totalMs + ms;
  return {
    count,
    totalMs,
    avgMs: totalMs / count,
    minMs: stats.count === 0 ? ms : Math.min(stats.minMs, ms),
    maxMs: stats.count === 0 ? ms : Math.max(stats.maxMs, ms),
  };
}

export class MemoryAnalyticsMonitor {
  private readonly maxEvents: number;
  private readonly slowRetrievalMs: number;
  private readonly now: () => number;
  private readonly createEventId: () => string;
  private readonly recent: MemoryRetrievalSample[] = [];
  private retrieval = emptyTiming();
  private slowRetrievals = 0;
  private consolidationsRun = 0;
  private merged = 0;
  private conflictsFlagged = 0;
  private skipped = 0;
  private lastConsolidation?: ConsolidationSnapshot;

  constructor(options: MemoryAnalyticsMonitorOptions = {}) {
    this.maxEvents = Math.max(
      1,
      Math.floor(options.maxEvents ?? DEFAULT_MAX_EVENTS),
    );
    this.slowRetrievalMs = Math.max(
      1,
      options.slowRetrievalMs ?? DEFAULT_SLOW_RETRIEVAL_MS,
    );
    this.now = options.now ?? (() => Date.now());
    this.createEventId =
      options.createEventId ??
      (() =>
        `mr_${this.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);
  }

  reset(): void {
    this.recent.length = 0;
    this.retrieval = emptyTiming();
    this.slowRetrievals = 0;
    this.consolidationsRun = 0;
    this.merged = 0;
    this.conflictsFlagged = 0;
    this.skipped = 0;
    this.lastConsolidation = undefined;
  }

  recordRetrieval(input: {
    tookMs: number;
    hits: number;
    mode?: string;
  }): MemoryRetrievalSample {
    const tookMs = Math.max(0, input.tookMs);
    const sample: MemoryRetrievalSample = {
      id: this.createEventId(),
      at: new Date(this.now()).toISOString(),
      tookMs,
      mode: input.mode,
      hits: Math.max(0, input.hits),
    };
    this.recent.push(sample);
    while (this.recent.length > this.maxEvents) {
      this.recent.shift();
    }
    this.retrieval = pushTiming(this.retrieval, tookMs);
    if (tookMs >= this.slowRetrievalMs) {
      this.slowRetrievals += 1;
    }
    return sample;
  }

  recordConsolidation(result: ConsolidationResult): ConsolidationSnapshot {
    const snapshot: ConsolidationSnapshot = {
      scanned: result.scanned,
      merged: result.merged,
      conflicts: result.conflicts,
      skipped: result.skipped,
      at: new Date(this.now()).toISOString(),
    };
    this.consolidationsRun += 1;
    this.merged += result.merged;
    this.conflictsFlagged += result.conflicts;
    this.skipped += result.skipped;
    this.lastConsolidation = snapshot;
    return snapshot;
  }

  getMetrics(): MemoryProcessMetrics {
    return {
      updatedAt: new Date(this.now()).toISOString(),
      retrieval: { ...this.retrieval },
      slowRetrievals: this.slowRetrievals,
      consolidationsRun: this.consolidationsRun,
      merged: this.merged,
      conflictsFlagged: this.conflictsFlagged,
      skipped: this.skipped,
      lastConsolidation: this.lastConsolidation
        ? { ...this.lastConsolidation }
        : undefined,
      recentRetrievals: [...this.recent],
    };
  }
}

export function createMemoryAnalyticsMonitor(
  options: MemoryAnalyticsMonitorOptions = {},
): MemoryAnalyticsMonitor {
  return new MemoryAnalyticsMonitor(options);
}
