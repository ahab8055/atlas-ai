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
} from "./types.js";

/**
 * Sync graph persistence port (in-memory or SQLite).
 */
export interface GraphStore {
  upsertEntity(input: CreateEntityInput): Entity;
  getEntity(id: string): Entity | undefined;
  updateEntity(id: string, patch: UpdateEntityInput): Entity;
  deleteEntity(id: string): boolean;
  listEntities(query?: EntityQuery): Entity[];

  upsertRelationship(input: CreateRelationshipInput): Relationship;
  getRelationship(id: string): Relationship | undefined;
  updateRelationship(id: string, patch: UpdateRelationshipInput): Relationship;
  deleteRelationship(id: string): boolean;
  listRelationships(query?: RelationshipQuery): Relationship[];
  neighbors(entityId: string, options?: NeighborOptions): NeighborHit[];
}
