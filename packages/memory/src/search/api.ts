/**
 * Unified Memory Search API (ADR-0055).
 */
import type {
  LongTermMemoryType,
  MemoriesRepository,
  MemoryRow,
} from "@atlas-ai/database";

import {
  createMemoryRetrievalEngine,
  type MemoryEmbeddingLookup,
  type MemoryRetrievalEngine,
  type RetrievalOptions,
  type RetrievalScoreWeights,
  type ScoreBreakdown,
} from "../retrieval/index.js";
import { DEFAULT_RETRIEVAL_WEIGHTS } from "../retrieval/types.js";
import type { MemoryRecord } from "../types.js";

export type MemorySearchMode = "keyword" | "semantic" | "hybrid";

export interface MemorySearchQuery {
  query: string;
  mode?: MemorySearchMode;
  type?: LongTermMemoryType;
  tags?: string[];
  userId?: string;
  sessionId?: string;
  /** Prefer project-scoped + unscoped (ADR-0051). */
  projectId?: string;
  limit?: number;
  minScore?: number;
  recencyHalfLifeMs?: number;
}

export interface MemorySearchHit {
  record: MemoryRecord;
  score: number;
  breakdown?: ScoreBreakdown;
}

export interface MemorySearchResult {
  hits: MemorySearchHit[];
  mode: MemorySearchMode;
  tookMs: number;
}

/** Keyword-first weights (lexical dominates). */
export const KEYWORD_SEARCH_WEIGHTS: RetrievalScoreWeights = {
  semantic: 0,
  lexical: 0.85,
  importance: 0.05,
  confidence: 0.05,
  recency: 0.05,
};

/** Semantic-first weights (hash / stored vectors dominate). */
export const SEMANTIC_SEARCH_WEIGHTS: RetrievalScoreWeights = {
  semantic: 0.85,
  lexical: 0,
  importance: 0.05,
  confidence: 0.05,
  recency: 0.05,
};

export function weightsForMode(mode: MemorySearchMode): RetrievalScoreWeights {
  switch (mode) {
    case "keyword":
      return { ...KEYWORD_SEARCH_WEIGHTS };
    case "semantic":
      return { ...SEMANTIC_SEARCH_WEIGHTS };
    case "hybrid":
    default:
      return { ...DEFAULT_RETRIEVAL_WEIGHTS };
  }
}

export interface MemorySearchApiOptions {
  embeddingLookup?: MemoryEmbeddingLookup;
  transformRow?: (row: MemoryRow) => MemoryRow | undefined;
}

/**
 * Common search entry for CLI, context retrievers, and other modules.
 */
export class MemorySearchApi {
  private readonly engine: MemoryRetrievalEngine;

  constructor(repo: MemoriesRepository, options: MemorySearchApiOptions = {}) {
    this.engine = createMemoryRetrievalEngine(repo, {
      embeddingLookup: options.embeddingLookup,
      transformRow: options.transformRow,
    });
  }

  search(input: MemorySearchQuery): MemorySearchResult {
    const mode = input.mode ?? "hybrid";
    const started = Date.now();
    const hits = this.engine.retrieve(input.query, {
      type: input.type,
      tags: input.tags,
      userId: input.userId,
      sessionId: input.sessionId,
      projectId: input.projectId,
      limit: input.limit,
      minScore: input.minScore,
      recencyHalfLifeMs: input.recencyHalfLifeMs,
      weights: weightsForMode(mode),
    });
    return {
      hits: hits.map((h) => ({
        record: h.record,
        score: h.score,
        breakdown: h.breakdown,
      })),
      mode,
      tookMs: Date.now() - started,
    };
  }
}

export function createMemorySearchApi(
  repo: MemoriesRepository,
  options: MemorySearchApiOptions = {},
): MemorySearchApi {
  return new MemorySearchApi(repo, options);
}

/** Convert search query fields into RetrievalOptions (for LTM wrappers). */
export function toRetrievalOptions(input: MemorySearchQuery): RetrievalOptions {
  const mode = input.mode ?? "hybrid";
  return {
    type: input.type,
    tags: input.tags,
    userId: input.userId,
    sessionId: input.sessionId,
    projectId: input.projectId,
    limit: input.limit,
    minScore: input.minScore,
    recencyHalfLifeMs: input.recencyHalfLifeMs,
    weights: weightsForMode(mode),
  };
}
