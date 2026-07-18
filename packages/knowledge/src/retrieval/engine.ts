/**
 * Ranked knowledge-graph context retrieval — sync, personal-scale.
 */
import type { KnowledgeGraphManager } from "../manager.js";
import type { Entity, Relationship } from "../types.js";
import {
  isEntityNameMatch,
  mergeKnowledgeWeights,
  scoreRetrievedEntity,
  tokenizeQuery,
} from "./score.js";
import {
  DEFAULT_KNOWLEDGE_RECENCY_HALF_LIFE_MS,
  DEFAULT_KNOWLEDGE_RETRIEVAL_LIMIT,
  DEFAULT_KNOWLEDGE_RETRIEVAL_MAX_DEPTH,
  DEFAULT_KNOWLEDGE_RETRIEVAL_MIN_SCORE,
  type KnowledgeRetrievalOptions,
  type RetrievedEntity,
} from "./types.js";

export class KnowledgeRetrievalEngine {
  constructor(private readonly graph: KnowledgeGraphManager) {}

  retrieve(
    text: string,
    options: KnowledgeRetrievalOptions = {},
  ): RetrievedEntity[] {
    const query = text?.trim() ?? "";
    if (!query) {
      return [];
    }

    const userId = options.userId ?? "local";
    const limit = Math.max(
      1,
      options.limit ?? DEFAULT_KNOWLEDGE_RETRIEVAL_LIMIT,
    );
    const minScore = options.minScore ?? DEFAULT_KNOWLEDGE_RETRIEVAL_MIN_SCORE;
    const maxDepth = Math.max(
      0,
      options.maxDepth ?? DEFAULT_KNOWLEDGE_RETRIEVAL_MAX_DEPTH,
    );
    const halfLife =
      options.recencyHalfLifeMs ?? DEFAULT_KNOWLEDGE_RECENCY_HALF_LIFE_MS;
    const weights = mergeKnowledgeWeights(options.weights);
    const nowMs = (options.now ?? Date.now)();
    const queryLower = query.toLowerCase();
    const tokens = tokenizeQuery(query);

    const pool = this.graph.listEntities({ userId, limit: 500 });
    const seeds = pool.filter((e) => isEntityNameMatch(e, queryLower));
    if (seeds.length === 0) {
      return [];
    }

    type Acc = {
      entity: Entity;
      hop: number;
      edgeWeight: number;
      via?: Relationship;
      viaFrom?: Entity;
    };
    const byId = new Map<string, Acc>();

    for (const seed of seeds.slice(0, 8)) {
      const prev = byId.get(seed.id);
      if (!prev || 0 < prev.hop) {
        byId.set(seed.id, {
          entity: seed,
          hop: 0,
          edgeWeight: 1,
        });
      }

      if (maxDepth === 0) {
        continue;
      }

      try {
        const hops = this.graph.traverse({
          startId: seed.id,
          maxDepth,
          userId,
          limit: Math.max(limit * 5, 50),
        });

        // BFS distances from seed via relationships
        const dist = new Map<string, number>();
        dist.set(seed.id, 0);
        const bestEdge = new Map<string, Relationship>();

        for (const rel of hops.relationships) {
          const fromDist = dist.get(rel.fromEntityId);
          const toDist = dist.get(rel.toEntityId);
          if (fromDist !== undefined) {
            const next = fromDist + 1;
            const cur = dist.get(rel.toEntityId);
            if (cur === undefined || next < cur) {
              dist.set(rel.toEntityId, next);
              bestEdge.set(rel.toEntityId, rel);
            }
          }
          if (toDist !== undefined) {
            const next = toDist + 1;
            const cur = dist.get(rel.fromEntityId);
            if (cur === undefined || next < cur) {
              dist.set(rel.fromEntityId, next);
              bestEdge.set(rel.fromEntityId, rel);
            }
          }
        }

        // Multi-pass to settle distances (small personal graphs)
        let changed = true;
        let guard = 0;
        while (changed && guard < 8) {
          changed = false;
          guard += 1;
          for (const rel of hops.relationships) {
            const fromDist = dist.get(rel.fromEntityId);
            const toDist = dist.get(rel.toEntityId);
            if (fromDist !== undefined) {
              const next = fromDist + 1;
              const cur = dist.get(rel.toEntityId) ?? Infinity;
              if (next < cur) {
                dist.set(rel.toEntityId, next);
                bestEdge.set(rel.toEntityId, rel);
                changed = true;
              }
            }
            if (toDist !== undefined) {
              const next = toDist + 1;
              const cur = dist.get(rel.fromEntityId) ?? Infinity;
              if (next < cur) {
                dist.set(rel.fromEntityId, next);
                bestEdge.set(rel.fromEntityId, rel);
                changed = true;
              }
            }
          }
        }

        for (const entity of hops.entities) {
          const hop = dist.get(entity.id) ?? maxDepth;
          if (hop > maxDepth) {
            continue;
          }
          const via = hop > 0 ? bestEdge.get(entity.id) : undefined;
          const edgeWeight = via?.weight ?? (hop === 0 ? 1 : 0.5);
          const existing = byId.get(entity.id);
          if (
            !existing ||
            hop < existing.hop ||
            (hop === existing.hop && edgeWeight > existing.edgeWeight)
          ) {
            byId.set(entity.id, {
              entity,
              hop,
              edgeWeight,
              via,
              viaFrom: hop > 0 ? seed : undefined,
            });
          }
        }
      } catch {
        // skip invalid seeds
      }
    }

    const scored: RetrievedEntity[] = [...byId.values()].map((acc) => {
      const breakdown = scoreRetrievedEntity({
        entity: acc.entity,
        tokens,
        hop: acc.hop,
        edgeWeight: acc.edgeWeight,
        nowMs,
        halfLifeMs: halfLife,
        weights,
      });
      return {
        entity: acc.entity,
        score: breakdown.total,
        breakdown,
        hop: acc.hop,
        via: acc.via,
        viaFrom: acc.viaFrom,
      };
    });

    return scored
      .filter((r) => r.score >= minScore)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return b.entity.updatedAt.localeCompare(a.entity.updatedAt);
      })
      .slice(0, limit);
  }
}

export function createKnowledgeRetrievalEngine(
  graph: KnowledgeGraphManager,
): KnowledgeRetrievalEngine {
  return new KnowledgeRetrievalEngine(graph);
}
