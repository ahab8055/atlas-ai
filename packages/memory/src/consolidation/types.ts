/**
 * Memory consolidation types (Architecture/04 Update Rules).
 */
import type { LongTermMemoryType } from "@atlas-ai/database";

import type { MemoryRecord } from "../types.js";

export type ConsolidationAction = "merge" | "flag_conflict" | "skip";

export interface ConsolidationThresholds {
  mergeMinScore: number;
  conflictMinScore: number;
  candidateLimit: number;
  consolidateOnStore: boolean;
}

export const DEFAULT_CONSOLIDATION_THRESHOLDS: ConsolidationThresholds = {
  mergeMinScore: 0.72,
  conflictMinScore: 0.55,
  candidateLimit: 10,
  consolidateOnStore: true,
};

export interface MemoryHistoryEntry {
  at: string;
  content: string;
  fromId?: string;
  reason: string;
}

export interface MemoryConflictMeta {
  withId: string;
  status: "open" | "resolved";
  detectedAt: string;
  note?: string;
}

export interface ConsolidationDecision {
  action: ConsolidationAction;
  score: number;
  survivorId: string;
  otherId: string;
  reason: string;
}

export interface ConsolidationPairResult {
  decision: ConsolidationDecision;
  survivor?: MemoryRecord;
  deletedId?: string;
  dryRun: boolean;
}

export interface ConsolidationResult {
  scanned: number;
  merged: number;
  conflicts: number;
  skipped: number;
  pairs: ConsolidationPairResult[];
}

export interface ConsolidateOptions {
  type?: LongTermMemoryType;
  userId?: string;
  limit?: number;
  dryRun?: boolean;
  thresholds?: Partial<ConsolidationThresholds>;
  now?: () => number;
}

export interface ConsolidateAgainstOptions {
  type: LongTermMemoryType;
  importance?: number;
  confidence?: number;
  tags?: string[];
  sessionId?: string;
  metadata?: Record<string, unknown>;
  thresholds?: Partial<ConsolidationThresholds>;
  now?: () => number;
}

export interface ConsolidateAgainstResult {
  action: ConsolidationAction | "insert";
  record: MemoryRecord;
  decision?: ConsolidationDecision;
  deletedId?: string;
}
