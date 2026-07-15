import {
  defaultDatabasePath,
  openDatabase,
  type OpenDatabaseOptions,
  type SqliteDatabase,
} from "./client.js";
import { ExecutionHistoryRepository } from "./repositories/execution-history.js";
import { SystemConfigRepository } from "./repositories/system-config.js";
import { ToolsRepository } from "./repositories/tools.js";
import { UserPreferencesRepository } from "./repositories/user-preferences.js";
import { SCHEMA_VERSION } from "./schema.js";
import { TaskHistoryService } from "./task-history.js";

/**
 * High-level Atlas database handle — initializes on open, exposes repositories.
 */
export class AtlasDatabase {
  readonly systemConfig: SystemConfigRepository;
  readonly userPreferences: UserPreferencesRepository;
  readonly tools: ToolsRepository;
  readonly executionHistory: ExecutionHistoryRepository;
  /** UI-oriented task history tracking (query + display DTOs). */
  readonly taskHistory: TaskHistoryService;

  private constructor(
    readonly db: SqliteDatabase,
    readonly path: string,
  ) {
    this.systemConfig = new SystemConfigRepository(db);
    this.userPreferences = new UserPreferencesRepository(db);
    this.tools = new ToolsRepository(db);
    this.executionHistory = new ExecutionHistoryRepository(db);
    this.taskHistory = new TaskHistoryService(this.executionHistory);
  }

  /** Schema version stamped in `schema_migrations`. */
  get schemaVersion(): number {
    return SCHEMA_VERSION;
  }

  close(): void {
    this.db.close();
  }

  /** Open Atlas SQLite and initialize automatically (schema + default seeds). */
  static open(options: OpenDatabaseOptions = {}): AtlasDatabase {
    const { db, path } = openDatabase(options);
    return new AtlasDatabase(db, path);
  }
}

/**
 * Open Atlas SQLite and initialize automatically (schema + default seeds).
 */
export function openAtlasDatabase(
  options: OpenDatabaseOptions = {},
): AtlasDatabase {
  return AtlasDatabase.open(options);
}

export { defaultDatabasePath };
