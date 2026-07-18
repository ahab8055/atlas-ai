import { KnowledgeError } from "./errors.js";
import type { GraphStore } from "./store.js";
import type {
  Entity,
  NeighborHit,
  NeighborOptions,
  Relationship,
  TraverseOptions,
  TraverseResult,
} from "./types.js";

const DEFAULT_MAX_DEPTH = 2;
const DEFAULT_VISIT_LIMIT = 200;

export function getNeighbors(
  store: GraphStore,
  entityId: string,
  options: NeighborOptions = {},
): NeighborHit[] {
  const hits = store.neighbors(entityId, options);
  return hits.map((hit) => ({
    ...hit,
    entity: hit.entity ?? store.getEntity(hit.entityId),
  }));
}

/**
 * Cycle-safe BFS from a start entity.
 */
export function traverseGraph(
  store: GraphStore,
  options: TraverseOptions,
): TraverseResult {
  const startId = options.startId?.trim();
  if (!startId) {
    throw new KnowledgeError("invalid_input", "traverse requires startId");
  }
  const start = store.getEntity(startId);
  if (!start) {
    throw new KnowledgeError("not_found", `Entity not found: ${startId}`);
  }

  const maxDepth = Math.max(0, options.maxDepth ?? DEFAULT_MAX_DEPTH);
  const visitLimit = Math.max(1, options.limit ?? DEFAULT_VISIT_LIMIT);
  const direction = options.direction ?? "both";
  const relationTypes = options.relationTypes;
  const userId = options.userId ?? start.userId;

  const entities = new Map<string, Entity>();
  const relationships = new Map<string, Relationship>();
  entities.set(start.id, start);

  type QueueItem = { id: string; depth: number };
  const queue: QueueItem[] = [{ id: start.id, depth: 0 }];
  const visited = new Set<string>([start.id]);

  while (queue.length > 0 && entities.size < visitLimit) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) {
      continue;
    }

    const hits = store.neighbors(current.id, {
      userId,
      direction,
      types: relationTypes,
      limit: visitLimit,
    });

    for (const hit of hits) {
      relationships.set(hit.relationship.id, hit.relationship);
      const neighbor = hit.entity ?? store.getEntity(hit.entityId);
      if (neighbor) {
        entities.set(neighbor.id, neighbor);
      }
      if (!visited.has(hit.entityId) && entities.size < visitLimit) {
        visited.add(hit.entityId);
        queue.push({ id: hit.entityId, depth: current.depth + 1 });
      }
    }
  }

  return {
    entities: [...entities.values()],
    relationships: [...relationships.values()],
    startId: start.id,
    maxDepth,
  };
}
