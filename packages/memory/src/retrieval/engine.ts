/**
 * Hybrid memory retrieval engine — sync, low-latency ranking.
 */
import type { MemoriesRepository, MemoryRow } from "@atlas-ai/database";

import { scopeForType } from "../types.js";
import type { MemoryRecord } from "../types.js";
import {
  buildQueryVector,
  mergeWeights,
  scoreCandidate,
  tokenizeQuery,
} from "./score.js";
import {
  DEFAULT_RECENCY_HALF_LIFE_MS,
  DEFAULT_RETRIEVAL_LIMIT,
  DEFAULT_RETRIEVAL_MIN_SCORE,
  type MemoryEmbeddingLookup,
  type RetrievalOptions,
  type RetrievedMemory,
} from "./types.js";

export interface MemoryRetrievalEngineOptions {
  embeddingLookup?: MemoryEmbeddingLookup;
}

export class MemoryRetrievalEngine {
  constructor(
    private readonly repo: MemoriesRepository,
    private readonly options: MemoryRetrievalEngineOptions = {},
  ) {}

  retrieve(text: string, options: RetrievalOptions = {}): RetrievedMemory[] {
    const query = text?.trim() ?? "";
    if (!query) {
      return [];
    }

    const limit = options.limit ?? DEFAULT_RETRIEVAL_LIMIT;
    const minScore = options.minScore ?? DEFAULT_RETRIEVAL_MIN_SCORE;
    const halfLife = options.recencyHalfLifeMs ?? DEFAULT_RECENCY_HALF_LIFE_MS;
    const weights = mergeWeights(options.weights);
    const nowMs = (options.now ?? Date.now)();

    const poolSize = Math.max(limit * 10, 50);
    const candidates = this.repo.list({
      type: options.type,
      tags: options.tags,
      userId: options.userId,
      sessionId: options.sessionId,
      projectIdOrUnscoped: options.projectId,
      limit: poolSize,
    });

    const queryTokens = tokenizeQuery(query);
    const queryVector = buildQueryVector(query);
    const vectors = this.options.embeddingLookup?.getVectors(
      candidates.map((c) => c.id),
    );

    const scored: RetrievedMemory[] = candidates.map((row) => {
      const breakdown = scoreCandidate({
        row,
        query,
        queryTokens,
        queryVector,
        storedVector: vectors?.get(row.id),
        nowMs,
        weights,
        recencyHalfLifeMs: halfLife,
      });
      return {
        record: rowToRecord(row),
        score: breakdown.total,
        breakdown,
      };
    });

    const activeProjectId = options.projectId;
    return scored
      .filter((m) => m.score >= minScore)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        // Prefer project-scoped over unscoped when filtering by project (ADR-0051).
        if (activeProjectId) {
          const aScoped = a.record.projectId === activeProjectId ? 1 : 0;
          const bScoped = b.record.projectId === activeProjectId ? 1 : 0;
          if (bScoped !== aScoped) {
            return bScoped - aScoped;
          }
        }
        return b.record.updatedAt.localeCompare(a.record.updatedAt);
      })
      .slice(0, limit);
  }
}

export function createMemoryRetrievalEngine(
  repo: MemoriesRepository,
  options: MemoryRetrievalEngineOptions = {},
): MemoryRetrievalEngine {
  return new MemoryRetrievalEngine(repo, options);
}

function rowToRecord(row: MemoryRow): MemoryRecord {
  return {
    id: row.id,
    type: row.type,
    scope: scopeForType(row.type),
    content: row.content,
    importance: row.importance,
    confidence: row.confidence,
    tags: row.tags.length > 0 ? [...row.tags] : undefined,
    sessionId: row.sessionId,
    projectId: row.projectId,
    metadata: { ...row.metadata },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
