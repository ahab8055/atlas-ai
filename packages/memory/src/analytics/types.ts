/**
 * Memory analytics types (ADR-0058).
 */
import type { MemoryStoreStats } from "@atlas-ai/database";

export interface TimingStats {
  count: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
}

export interface MemoryRetrievalSample {
  id: string;
  at: string;
  tookMs: number;
  mode?: string;
  hits: number;
}

export interface ConsolidationSnapshot {
  scanned: number;
  merged: number;
  conflicts: number;
  skipped: number;
  at: string;
}

export interface MemoryProcessMetrics {
  updatedAt: string;
  retrieval: TimingStats;
  slowRetrievals: number;
  consolidationsRun: number;
  merged: number;
  conflictsFlagged: number;
  skipped: number;
  lastConsolidation?: ConsolidationSnapshot;
  recentRetrievals: MemoryRetrievalSample[];
}

export interface MemoryStatsReport {
  updatedAt: string;
  store: MemoryStoreStats;
  openConflicts: number;
  process: MemoryProcessMetrics;
}

export interface MemoryAnalyticsMonitorOptions {
  maxEvents?: number;
  /** NFR retrieval target; samples at or above count as slow. */
  slowRetrievalMs?: number;
  now?: () => number;
  createEventId?: () => string;
}

/** Default NFR from Architecture/04 / Memory-Retrieval (&lt;500ms). */
export const DEFAULT_SLOW_RETRIEVAL_MS = 500;
