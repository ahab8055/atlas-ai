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
  createKnowledgeRetriever,
  createLexicalKnowledgeRetriever,
  entityToSnippet,
  toKnowledgeSnippets,
  traverseToSnippets,
  type KnowledgeRetrieverOptions,
  type KnowledgeRetrieverOptions as LexicalKnowledgeRetrieverOptions,
} from "./context.js";

export {
  KnowledgeRetrievalEngine,
  createKnowledgeRetrievalEngine,
  DEFAULT_KNOWLEDGE_RECENCY_HALF_LIFE_MS,
  DEFAULT_KNOWLEDGE_RETRIEVAL_LIMIT,
  DEFAULT_KNOWLEDGE_RETRIEVAL_MAX_DEPTH,
  DEFAULT_KNOWLEDGE_RETRIEVAL_MIN_SCORE,
  DEFAULT_KNOWLEDGE_RETRIEVAL_WEIGHTS,
  type KnowledgeRetrievalOptions,
  type KnowledgeRetrievalWeights,
  type KnowledgeScoreBreakdown,
  type RetrievedEntity,
} from "./retrieval/index.js";

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
