/**
 * Memory retrieval types (Architecture/04 Memory Retrieval Pipeline).
 */
import type { LongTermMemoryType } from "@atlas-ai/database";

import type { MemoryRecord } from "../types.js";

export interface RetrievalScoreWeights {
  semantic: number;
  lexical: number;
  importance: number;
  confidence: number;
  recency: number;
}

/** Locked hybrid weights (sum = 1). */
export const DEFAULT_RETRIEVAL_WEIGHTS: RetrievalScoreWeights = {
  semantic: 0.4,
  lexical: 0.25,
  importance: 0.15,
  confidence: 0.05,
  recency: 0.15,
};

export const DEFAULT_RETRIEVAL_LIMIT = 5;
export const DEFAULT_RETRIEVAL_MIN_SCORE = 0.15;
/** 30 days */
export const DEFAULT_RECENCY_HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000;
export const DEFAULT_VECTOR_DIMENSIONS = 384;

export interface RetrievalOptions {
  type?: LongTermMemoryType;
  tags?: string[];
  userId?: string;
  limit?: number;
  minScore?: number;
  recencyHalfLifeMs?: number;
  weights?: Partial<RetrievalScoreWeights>;
  /** Override clock for tests. */
  now?: () => number;
}

export interface ScoreBreakdown {
  total: number;
  semantic: number;
  lexical: number;
  importance: number;
  confidence: number;
  recency: number;
}

export interface RetrievedMemory {
  record: MemoryRecord;
  score: number;
  breakdown: ScoreBreakdown;
}

/** Optional sync lookup for stored embedding vectors (collection=memory). */
export interface MemoryEmbeddingLookup {
  getVectors(ids: string[]): Map<string, number[]>;
}
