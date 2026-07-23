export { SCHEMA_SQL, SCHEMA_VERSION } from "./schema.js";
export {
  defaultDatabasePath,
  migrate,
  openDatabase,
  resolveDatabasePath,
  type OpenDatabaseOptions,
  type SqliteDatabase,
} from "./client.js";
export { AtlasDatabase, openAtlasDatabase } from "./database.js";

export {
  SystemConfigRepository,
  type SystemConfigRow,
} from "./repositories/system-config.js";
export {
  UserPreferencesRepository,
  type PreferenceSource,
  type UserPreferenceListOptions,
  type UserPreferenceRow,
  type UserPreferenceSetOptions,
} from "./repositories/user-preferences.js";
export {
  ToolsRepository,
  type ToolRecordInput,
  type ToolRow,
} from "./repositories/tools.js";
export {
  ModelsRepository,
  type ModelFormat,
  type ModelQuery,
  type ModelRecordInput,
  type ModelRequirements,
  type ModelRow,
  type ModelStatus,
} from "./repositories/models.js";
export {
  EmbeddingsRepository,
  type EmbeddingListQuery,
  type EmbeddingRecordInput,
  type EmbeddingRow,
} from "./repositories/embeddings.js";
export {
  MemoriesRepository,
  type LongTermMemoryType,
  type MemoryListQuery,
  type MemoryRecordInput,
  type MemoryRow,
  type MemorySensitivity,
  type MemoryStoreStats,
  type MemoryUpdateInput,
} from "./repositories/memories.js";
export {
  ProjectsRepository,
  type ProjectListQuery,
  type ProjectRow,
  type ProjectUpsertInput,
} from "./repositories/projects.js";
export {
  RecentFilesRepository,
  type RecentFileAction,
  type RecentFileRow,
  type RecentFileTouchInput,
  type RecentFilesListQuery,
  type RecentFilesSort,
} from "./repositories/recent-files.js";
export {
  IndexedFilesRepository,
  type IndexedFileRow,
  type IndexedFileSearchHit,
  type IndexedFileStatus,
  type IndexedFileUpsertInput,
  type IndexedFilesFtsQuery,
  type IndexedFilesListQuery,
  type IndexedFilesStatusSummary,
} from "./repositories/indexed-files.js";
export {
  PreferenceObservationsRepository,
  type PreferenceObservationIncrementInput,
  type PreferenceObservationRow,
} from "./repositories/preference-observations.js";
export {
  PreferenceSuggestionsRepository,
  type PreferenceSuggestionRow,
  type PreferenceSuggestionStatus,
  type PreferenceSuggestionUpsertInput,
} from "./repositories/preference-suggestions.js";
export {
  EntitiesRepository,
  type EntityListQuery,
  type EntityRecordInput,
  type EntityRow,
  type EntityUpdateInput,
} from "./repositories/entities.js";
export {
  RelationshipsRepository,
  type NeighborDirection,
  type NeighborEdge,
  type NeighborQuery,
  type RelationshipListQuery,
  type RelationshipRecordInput,
  type RelationshipRow,
  type RelationshipUpdateInput,
} from "./repositories/relationships.js";
export {
  ExecutionHistoryRepository,
  type ExecutionFailureInput,
  type ExecutionHistoryInput,
  type ExecutionHistoryQuery,
  type ExecutionHistoryRow,
  type ExecutionStepInput,
  type TaskExecutionRow,
} from "./repositories/execution-history.js";
export {
  TaskHistoryService,
  type TaskHistoryEntry,
  type TaskHistoryFailure,
  type TaskHistoryQuery,
  type TaskHistoryQueryResult,
  type TaskHistoryStep,
} from "./task-history.js";
