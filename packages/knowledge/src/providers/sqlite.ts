import type {
  AtlasDatabase,
  EntityRow,
  RelationshipRow,
} from "@atlas-ai/database";

import { KnowledgeError } from "../errors.js";
import type { GraphStore } from "../store.js";
import type {
  CreateEntityInput,
  CreateRelationshipInput,
  Entity,
  EntityQuery,
  NeighborHit,
  NeighborOptions,
  Relationship,
  RelationshipQuery,
  UpdateEntityInput,
  UpdateRelationshipInput,
} from "../types.js";

function toEntity(row: EntityRow): Entity {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    name: row.name,
    properties: row.properties,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRelationship(row: RelationshipRow): Relationship {
  return {
    id: row.id,
    userId: row.userId,
    fromEntityId: row.fromEntityId,
    toEntityId: row.toEntityId,
    type: row.type,
    weight: row.weight,
    properties: row.properties,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function wrapDbError(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (/not found/i.test(message)) {
    throw new KnowledgeError("not_found", message);
  }
  if (/endpoints must|existing entities/i.test(message)) {
    throw new KnowledgeError("missing_endpoint", message);
  }
  if (/required|weight|distinct/i.test(message)) {
    throw new KnowledgeError("invalid_input", message);
  }
  throw new KnowledgeError("invalid_input", message);
}

/**
 * SQLite-backed graph store via `@atlas-ai/database` repositories.
 */
export class SqliteGraphStore implements GraphStore {
  constructor(private readonly db: AtlasDatabase) {}

  upsertEntity(input: CreateEntityInput): Entity {
    try {
      return toEntity(
        this.db.entities.upsert({
          id: input.id,
          userId: input.userId,
          type: input.type,
          name: input.name,
          properties: input.properties,
        }),
      );
    } catch (error) {
      wrapDbError(error);
    }
  }

  getEntity(id: string): Entity | undefined {
    const row = this.db.entities.get(id);
    return row ? toEntity(row) : undefined;
  }

  updateEntity(id: string, patch: UpdateEntityInput): Entity {
    try {
      return toEntity(
        this.db.entities.update(id, {
          name: patch.name,
          type: patch.type,
          properties: patch.properties,
        }),
      );
    } catch (error) {
      wrapDbError(error);
    }
  }

  deleteEntity(id: string): boolean {
    return this.db.entities.delete(id);
  }

  listEntities(query: EntityQuery = {}): Entity[] {
    return this.db.entities
      .list({
        userId: query.userId,
        type: query.type,
        name: query.name,
        limit: query.limit,
      })
      .map(toEntity);
  }

  upsertRelationship(input: CreateRelationshipInput): Relationship {
    try {
      return toRelationship(
        this.db.relationships.upsert({
          id: input.id,
          userId: input.userId,
          fromEntityId: input.fromEntityId,
          toEntityId: input.toEntityId,
          type: input.type,
          weight: input.weight,
          properties: input.properties,
        }),
      );
    } catch (error) {
      wrapDbError(error);
    }
  }

  getRelationship(id: string): Relationship | undefined {
    const row = this.db.relationships.get(id);
    return row ? toRelationship(row) : undefined;
  }

  updateRelationship(id: string, patch: UpdateRelationshipInput): Relationship {
    try {
      return toRelationship(
        this.db.relationships.update(id, {
          type: patch.type,
          weight: patch.weight,
          properties: patch.properties,
        }),
      );
    } catch (error) {
      wrapDbError(error);
    }
  }

  deleteRelationship(id: string): boolean {
    return this.db.relationships.delete(id);
  }

  listRelationships(query: RelationshipQuery = {}): Relationship[] {
    return this.db.relationships
      .list({
        userId: query.userId,
        fromEntityId: query.fromEntityId,
        toEntityId: query.toEntityId,
        type: query.type,
        types: query.types,
        limit: query.limit,
      })
      .map(toRelationship);
  }

  neighbors(entityId: string, options: NeighborOptions = {}): NeighborHit[] {
    return this.db.relationships
      .neighbors(entityId, {
        userId: options.userId,
        direction: options.direction,
        types: options.types,
        limit: options.limit,
      })
      .map((hit) => ({
        relationship: toRelationship(hit.relationship),
        entityId: hit.entityId,
        entity: this.getEntity(hit.entityId),
      }));
  }
}

export function createSqliteGraphStore(db: AtlasDatabase): SqliteGraphStore {
  return new SqliteGraphStore(db);
}
