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
  type UserPreferenceRow,
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
