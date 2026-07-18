export type {
  CreateEntityInput,
  CreateRelationshipInput,
  Entity,
  EntityQuery,
  EntityType,
  ExportSnapshotOptions,
  GraphEdgeView,
  GraphNodeView,
  GraphSnapshot,
  KnownEntityType,
  KnownRelationshipType,
  KnowledgeSnippetView,
  NeighborHit,
  NeighborOptions,
  Relationship,
  RelationshipQuery,
  RelationshipType,
  TraverseDirection,
  TraverseOptions,
  TraverseResult,
  UpdateEntityInput,
  UpdateRelationshipInput,
} from "./types.js";

export { KNOWN_ENTITY_TYPES, KNOWN_RELATIONSHIP_TYPES } from "./types.js";

export type { KnowledgeErrorCode } from "./errors.js";
export { KnowledgeError } from "./errors.js";

export type { GraphStore } from "./store.js";

export {
  KnowledgeGraphManager,
  createInMemoryKnowledgeGraph,
  createKnowledgeGraph,
  type KnowledgeGraphManagerOptions,
} from "./manager.js";

export { toGraphSnapshot } from "./snapshot.js";
export { getNeighbors, traverseGraph } from "./traverse.js";

export {
  createLexicalKnowledgeRetriever,
  entityToSnippet,
  toKnowledgeSnippets,
  traverseToSnippets,
  type LexicalKnowledgeRetrieverOptions,
} from "./context.js";

export {
  InMemoryGraphStore,
  createInMemoryGraphStore,
} from "./providers/in-memory.js";

export {
  SqliteGraphStore,
  createSqliteGraphStore,
} from "./providers/sqlite.js";
