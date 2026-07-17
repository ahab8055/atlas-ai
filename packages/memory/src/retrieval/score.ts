/**
 * Hybrid candidate scoring: semantic + lexical + importance + confidence + recency.
 */
import type { MemoryRow } from "@atlas-ai/database";

import {
  DEFAULT_RECENCY_HALF_LIFE_MS,
  DEFAULT_RETRIEVAL_WEIGHTS,
  DEFAULT_VECTOR_DIMENSIONS,
  type RetrievalScoreWeights,
  type ScoreBreakdown,
} from "./types.js";
import { cosineSimilarity, hashTextToVector } from "./vectors.js";

export interface ScoreCandidateInput {
  row: MemoryRow;
  query: string;
  queryTokens: string[];
  queryVector: number[];
  /** Stored embedding for this memory id, if any. */
  storedVector?: number[];
  nowMs: number;
  weights: RetrievalScoreWeights;
  recencyHalfLifeMs: number;
}

export function mergeWeights(
  partial?: Partial<RetrievalScoreWeights>,
): RetrievalScoreWeights {
  return { ...DEFAULT_RETRIEVAL_WEIGHTS, ...partial };
}

export function tokenizeQuery(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

export function buildQueryVector(text: string): number[] {
  return hashTextToVector(text, DEFAULT_VECTOR_DIMENSIONS);
}

/** Lexical overlap 0–1 (normalized token hits + tag boost). */
export function lexicalScore(row: MemoryRow, tokens: string[]): number {
  if (tokens.length === 0) {
    return 0;
  }
  const hay = row.content.toLowerCase();
  let hits = 0;
  for (const token of tokens) {
    if (hay.includes(token)) {
      hits += 1;
    }
  }
  let score = hits / tokens.length;
  if (row.tags.some((t) => tokens.includes(t.toLowerCase()))) {
    score = Math.min(1, score + 0.15);
  }
  return clamp01(score);
}

export function semanticScore(
  content: string,
  queryVector: number[],
  storedVector?: number[],
): number {
  const docVector =
    storedVector && storedVector.length === queryVector.length
      ? storedVector
      : hashTextToVector(content, queryVector.length);
  // Cosine is [-1,1]; map to [0,1] for hybrid mix
  return clamp01((cosineSimilarity(queryVector, docVector) + 1) / 2);
}

export function recencyScore(
  updatedAtIso: string,
  nowMs: number,
  halfLifeMs: number,
): number {
  const updated = Date.parse(updatedAtIso);
  if (!Number.isFinite(updated)) {
    return 0.5;
  }
  const age = Math.max(0, nowMs - updated);
  const half = halfLifeMs > 0 ? halfLifeMs : DEFAULT_RECENCY_HALF_LIFE_MS;
  return clamp01(Math.exp(-age / half));
}

export function scoreCandidate(input: ScoreCandidateInput): ScoreBreakdown {
  const w = input.weights;
  const semantic = semanticScore(
    input.row.content,
    input.queryVector,
    input.storedVector,
  );
  const lexical = lexicalScore(input.row, input.queryTokens);
  const importance = clamp01(input.row.importance ?? 0.5);
  const confidence = clamp01(input.row.confidence ?? 0);
  const recency = recencyScore(
    input.row.updatedAt,
    input.nowMs,
    input.recencyHalfLifeMs,
  );

  const total =
    w.semantic * semantic +
    w.lexical * lexical +
    w.importance * importance +
    w.confidence * confidence +
    w.recency * recency;

  return {
    total: clamp01(total),
    semantic,
    lexical,
    importance,
    confidence,
    recency,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}
