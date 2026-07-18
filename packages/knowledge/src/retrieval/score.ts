import type { Entity } from "../types.js";
import {
  DEFAULT_KNOWLEDGE_RETRIEVAL_WEIGHTS,
  type KnowledgeRetrievalWeights,
  type KnowledgeScoreBreakdown,
} from "./types.js";

export function mergeKnowledgeWeights(
  partial?: Partial<KnowledgeRetrievalWeights>,
): KnowledgeRetrievalWeights {
  return { ...DEFAULT_KNOWLEDGE_RETRIEVAL_WEIGHTS, ...partial };
}

export function tokenizeQuery(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

/** Lexical overlap of entity name with query tokens (0–1). */
export function lexicalEntityScore(entity: Entity, tokens: string[]): number {
  if (tokens.length === 0) {
    return 0;
  }
  const name = entity.name.toLowerCase();
  const nameTokens = name.split(/\s+/).filter((t) => t.length > 0);
  let hits = 0;
  for (const token of tokens) {
    if (name.includes(token) || nameTokens.some((n) => n.includes(token))) {
      hits += 1;
    }
  }
  let score = hits / tokens.length;
  // Full-name containment boost
  if (
    tokens.join(" ").includes(name) ||
    nameTokens.every((n) => tokens.includes(n))
  ) {
    score = Math.min(1, score + 0.25);
  }
  return clamp01(score);
}

/** Graph signal: edgeWeight * 1/(1+hop); hop 0 uses weight 1. */
export function graphHopScore(hop: number, edgeWeight: number): number {
  const w = hop === 0 ? 1 : clamp01(edgeWeight);
  return clamp01(w * (1 / (1 + Math.max(0, hop))));
}

export function recencyScore(
  updatedAtIso: string,
  nowMs: number,
  halfLifeMs: number,
): number {
  const updated = Date.parse(updatedAtIso);
  if (!Number.isFinite(updated) || halfLifeMs <= 0) {
    return 0.5;
  }
  const age = Math.max(0, nowMs - updated);
  return clamp01(Math.pow(0.5, age / halfLifeMs));
}

export function scoreRetrievedEntity(input: {
  entity: Entity;
  tokens: string[];
  hop: number;
  edgeWeight: number;
  nowMs: number;
  halfLifeMs: number;
  weights: KnowledgeRetrievalWeights;
}): KnowledgeScoreBreakdown {
  const lexical = lexicalEntityScore(input.entity, input.tokens);
  const graph = graphHopScore(input.hop, input.edgeWeight);
  const recency = recencyScore(
    input.entity.updatedAt,
    input.nowMs,
    input.halfLifeMs,
  );
  const total = clamp01(
    input.weights.lexical * lexical +
      input.weights.graph * graph +
      input.weights.recency * recency,
  );
  return { lexical, graph, recency, total };
}

/** True if entity name appears in query (seed match). */
export function isEntityNameMatch(entity: Entity, queryLower: string): boolean {
  const name = entity.name.toLowerCase();
  if (!name || !queryLower) {
    return false;
  }
  if (queryLower.includes(name)) {
    return true;
  }
  return name.split(/\s+/).some((t) => t.length > 2 && queryLower.includes(t));
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.min(1, Math.max(0, n));
}
