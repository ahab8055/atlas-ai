import { KnowledgeError } from "./errors.js";
import {
  extractAndStoreEntities,
  extractEntities,
  type ExtractAndStoreResult,
  type ExtractEntitiesOptions,
  type ExtractEntitiesResult,
  type IngestOptions,
} from "./extraction/index.js";
import { createInMemoryGraphStore } from "./providers/in-memory.js";
import {
  linkEntities,
  type LinkEntitiesInput,
  type LinkResult,
} from "./relationships/index.js";
import { toGraphSnapshot } from "./snapshot.js";
import type { GraphStore } from "./store.js";
import { getNeighbors, traverseGraph } from "./traverse.js";
import type {
  CreateEntityInput,
  CreateRelationshipInput,
  Entity,
  EntityQuery,
  EntityType,
  ExportSnapshotOptions,
  GraphSnapshot,
  NeighborHit,
  NeighborOptions,
  Relationship,
  RelationshipQuery,
  TraverseOptions,
  TraverseResult,
  UpdateEntityInput,
  UpdateRelationshipInput,
} from "./types.js";

export interface KnowledgeGraphManagerOptions {
  store?: GraphStore;
}

export interface FindEntityByNameOptions {
  userId?: string;
}

/**
 * Facade for entity/relationship CRUD, traversal, extraction, and viz export.
 */
export class KnowledgeGraphManager {
  readonly store: GraphStore;

  constructor(options: KnowledgeGraphManagerOptions = {}) {
    this.store = options.store ?? createInMemoryGraphStore();
  }

  upsertEntity(input: CreateEntityInput): Entity {
    return this.store.upsertEntity(input);
  }

  getEntity(id: string): Entity | undefined {
    return this.store.getEntity(id);
  }

  /**
   * Case-insensitive lookup by type + name.
   */
  findEntityByName(
    type: EntityType,
    name: string,
    options: FindEntityByNameOptions = {},
  ): Entity | undefined {
    const userId = options.userId ?? "local";
    const lower = name.trim().toLowerCase();
    return this.store
      .listEntities({ userId, type, limit: 500 })
      .find((e) => e.name.toLowerCase() === lower);
  }

  updateEntity(id: string, patch: UpdateEntityInput): Entity {
    return this.store.updateEntity(id, patch);
  }

  deleteEntity(id: string): boolean {
    return this.store.deleteEntity(id);
  }

  listEntities(query?: EntityQuery): Entity[] {
    return this.store.listEntities(query);
  }

  upsertRelationship(input: CreateRelationshipInput): Relationship {
    return this.store.upsertRelationship(input);
  }

  getRelationship(id: string): Relationship | undefined {
    return this.store.getRelationship(id);
  }

  updateRelationship(id: string, patch: UpdateRelationshipInput): Relationship {
    return this.store.updateRelationship(id, patch);
  }

  deleteRelationship(id: string): boolean {
    return this.store.deleteRelationship(id);
  }

  listRelationships(query?: RelationshipQuery): Relationship[] {
    return this.store.listRelationships(query);
  }

  /**
   * Create or reinforce a typed edge between entities (by id or type+name).
   */
  linkEntities(input: LinkEntitiesInput): LinkResult {
    return linkEntities(this, input);
  }

  getNeighbors(entityId: string, options?: NeighborOptions): NeighborHit[] {
    if (!this.store.getEntity(entityId)) {
      throw new KnowledgeError("not_found", `Entity not found: ${entityId}`);
    }
    return getNeighbors(this.store, entityId, options);
  }

  traverse(options: TraverseOptions): TraverseResult {
    return traverseGraph(this.store, options);
  }

  extractEntities(
    text: string,
    options?: ExtractEntitiesOptions,
  ): ExtractEntitiesResult {
    return extractEntities(text, options);
  }

  extractAndStore(
    text: string,
    options?: IngestOptions,
  ): ExtractAndStoreResult {
    return extractAndStoreEntities(this, text, options);
  }

  /**
   * Full graph or ego subgraph as viz-ready JSON.
   */
  exportSnapshot(options: ExportSnapshotOptions = {}): GraphSnapshot {
    if (options.startId?.trim()) {
      const result = traverseGraph(this.store, {
        startId: options.startId.trim(),
        maxDepth: options.maxDepth ?? 2,
        direction: options.direction,
        relationTypes: options.relationTypes,
        userId: options.userId,
      });
      return toGraphSnapshot(result.entities, result.relationships);
    }
    const userId = options.userId ?? "local";
    const entities = this.store.listEntities({ userId, limit: 10_000 });
    const relationships = this.store.listRelationships({
      userId,
      limit: 20_000,
    });
    return toGraphSnapshot(entities, relationships);
  }
}

export function createKnowledgeGraph(
  store?: GraphStore,
): KnowledgeGraphManager {
  return new KnowledgeGraphManager({ store });
}

export function createInMemoryKnowledgeGraph(): KnowledgeGraphManager {
  return createKnowledgeGraph(createInMemoryGraphStore());
}
