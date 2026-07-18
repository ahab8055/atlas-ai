/**
 * Knowledge graph context retrieval types (ADR-0049).
 */
import type { Entity, Relationship } from "../types.js";

export interface KnowledgeRetrievalWeights {
  lexical: number;
  graph: number;
  recency: number;
}

/** Locked weights (sum = 1). */
export const DEFAULT_KNOWLEDGE_RETRIEVAL_WEIGHTS: KnowledgeRetrievalWeights = {
  lexical: 0.45,
  graph: 0.3,
  recency: 0.25,
};

export const DEFAULT_KNOWLEDGE_RETRIEVAL_LIMIT = 8;
export const DEFAULT_KNOWLEDGE_RETRIEVAL_MIN_SCORE = 0.2;
export const DEFAULT_KNOWLEDGE_RETRIEVAL_MAX_DEPTH = 2;
/** 30 days */
export const DEFAULT_KNOWLEDGE_RECENCY_HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000;

export interface KnowledgeRetrievalOptions {
  userId?: string;
  limit?: number;
  minScore?: number;
  maxDepth?: number;
  recencyHalfLifeMs?: number;
  weights?: Partial<KnowledgeRetrievalWeights>;
  now?: () => number;
}

export interface KnowledgeScoreBreakdown {
  lexical: number;
  graph: number;
  recency: number;
  total: number;
}

export interface RetrievedEntity {
  entity: Entity;
  score: number;
  breakdown: KnowledgeScoreBreakdown;
  hop: number;
  /** Best connecting edge when hop >= 1. */
  via?: Relationship;
  /** Seed entity that expanded to this hit (when hop >= 1). */
  viaFrom?: Entity;
}
