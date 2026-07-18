/**
 * Knowledge graph domain types (Architecture/23, ADR-0046).
 */

export const KNOWN_ENTITY_TYPES = [
  "project",
  "person",
  "technology",
  "file",
  "concept",
  "location",
  "preference",
  "company",
  "application",
] as const;

export type KnownEntityType = (typeof KNOWN_ENTITY_TYPES)[number];

/** Entity type: known set or open custom string. */
export type EntityType = KnownEntityType | (string & {});

export const KNOWN_RELATIONSHIP_TYPES = [
  "part_of",
  "depends_on",
  "uses",
  "related_to",
  "located_at",
  "prefers",
] as const;

export type KnownRelationshipType = (typeof KNOWN_RELATIONSHIP_TYPES)[number];

/** Relationship type: known set or open custom string. */
export type RelationshipType = KnownRelationshipType | (string & {});

export interface Entity {
  id: string;
  userId: string;
  type: EntityType;
  name: string;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Relationship {
  id: string;
  userId: string;
  fromEntityId: string;
  toEntityId: string;
  type: RelationshipType;
  weight?: number;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEntityInput {
  id?: string;
  userId?: string;
  type: EntityType;
  name: string;
  properties?: Record<string, unknown>;
}

export interface UpdateEntityInput {
  name?: string;
  type?: EntityType;
  properties?: Record<string, unknown>;
}

export interface CreateRelationshipInput {
  id?: string;
  userId?: string;
  fromEntityId: string;
  toEntityId: string;
  type: RelationshipType;
  weight?: number;
  properties?: Record<string, unknown>;
}

export interface UpdateRelationshipInput {
  type?: RelationshipType;
  weight?: number | null;
  properties?: Record<string, unknown>;
}

export interface EntityQuery {
  userId?: string;
  type?: EntityType;
  name?: string;
  limit?: number;
}

export interface RelationshipQuery {
  userId?: string;
  fromEntityId?: string;
  toEntityId?: string;
  type?: RelationshipType;
  types?: RelationshipType[];
  limit?: number;
}

export type TraverseDirection = "out" | "in" | "both";

export interface NeighborOptions {
  userId?: string;
  direction?: TraverseDirection;
  types?: RelationshipType[];
  limit?: number;
}

export interface NeighborHit {
  relationship: Relationship;
  /** The other endpoint relative to the queried entity. */
  entityId: string;
  entity?: Entity;
}

export interface TraverseOptions {
  startId: string;
  maxDepth?: number;
  direction?: TraverseDirection;
  relationTypes?: RelationshipType[];
  userId?: string;
  /** Max entities to visit (safety cap). */
  limit?: number;
}

export interface TraverseResult {
  entities: Entity[];
  relationships: Relationship[];
  startId: string;
  maxDepth: number;
}

export interface GraphNodeView {
  id: string;
  label: string;
  type: string;
  properties: Record<string, unknown>;
}

export interface GraphEdgeView {
  id: string;
  source: string;
  target: string;
  type: string;
  weight?: number;
  properties: Record<string, unknown>;
}

/** Viz-ready subgraph export (Architecture/23). */
export interface GraphSnapshot {
  nodes: GraphNodeView[];
  edges: GraphEdgeView[];
}

export interface ExportSnapshotOptions {
  startId?: string;
  maxDepth?: number;
  direction?: TraverseDirection;
  relationTypes?: RelationshipType[];
  userId?: string;
}

/**
 * Core-compatible snippet without depending on @atlas-ai/core.
 */
export interface KnowledgeSnippetView {
  id: string;
  label: string;
  content: string;
  /** Hybrid retrieval score when present (ADR-0049). */
  score?: number;
}
