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

export type {
  ExtractAndStoreResult,
  ExtractEntitiesOptions,
  ExtractEntitiesResult,
  ExtractedEntityCandidate,
  ExtractionThresholds,
  IngestOptions,
  IngestedEntity,
} from "./extraction/index.js";

export {
  DEFAULT_EXTRACTION_THRESHOLDS,
  entityDedupeKey,
  extractAndStoreEntities,
  extractEntities,
  ingestExtractedEntities,
  normalizeEntityName,
} from "./extraction/index.js";

export type {
  CoMentionOptions,
  LinkEntitiesInput,
  LinkEndpoint,
  LinkResult,
  LinkSource,
  ReinforceOptions,
} from "./relationships/index.js";

export {
  DEFAULT_REINFORCE_STEP,
  computeReinforce,
  linkCoMentions,
  linkEntities,
} from "./relationships/index.js";

export {
  InMemoryGraphStore,
  createInMemoryGraphStore,
} from "./providers/in-memory.js";

export {
  SqliteGraphStore,
  createSqliteGraphStore,
} from "./providers/sqlite.js";
