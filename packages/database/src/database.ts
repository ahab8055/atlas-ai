import {
  defaultDatabasePath,
  openDatabase,
  type OpenDatabaseOptions,
  type SqliteDatabase,
} from "./client.js";
import { EmbeddingsRepository } from "./repositories/embeddings.js";
import { EntitiesRepository } from "./repositories/entities.js";
import { ExecutionHistoryRepository } from "./repositories/execution-history.js";
import { MemoriesRepository } from "./repositories/memories.js";
import { ModelsRepository } from "./repositories/models.js";
import { PreferenceObservationsRepository } from "./repositories/preference-observations.js";
import { PreferenceSuggestionsRepository } from "./repositories/preference-suggestions.js";
import { ProjectsRepository } from "./repositories/projects.js";
import { RecentFilesRepository } from "./repositories/recent-files.js";
import { IndexedFilesRepository } from "./repositories/indexed-files.js";
import { RelationshipsRepository } from "./repositories/relationships.js";
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
  readonly preferenceObservations: PreferenceObservationsRepository;
  readonly preferenceSuggestions: PreferenceSuggestionsRepository;
  readonly tools: ToolsRepository;
  readonly models: ModelsRepository;
  readonly embeddings: EmbeddingsRepository;
  readonly memories: MemoriesRepository;
  readonly projects: ProjectsRepository;
  readonly recentFiles: RecentFilesRepository;
  readonly indexedFiles: IndexedFilesRepository;
  readonly entities: EntitiesRepository;
  readonly relationships: RelationshipsRepository;
  readonly executionHistory: ExecutionHistoryRepository;
  /** UI-oriented task history tracking (query + display DTOs). */
  readonly taskHistory: TaskHistoryService;

  private constructor(
    readonly db: SqliteDatabase,
    readonly path: string,
  ) {
    this.systemConfig = new SystemConfigRepository(db);
    this.userPreferences = new UserPreferencesRepository(db);
    this.preferenceObservations = new PreferenceObservationsRepository(db);
    this.preferenceSuggestions = new PreferenceSuggestionsRepository(db);
    this.tools = new ToolsRepository(db);
    this.models = new ModelsRepository(db);
    this.embeddings = new EmbeddingsRepository(db);
    this.memories = new MemoriesRepository(db);
    this.projects = new ProjectsRepository(db);
    this.recentFiles = new RecentFilesRepository(db);
    this.indexedFiles = new IndexedFilesRepository(db);
    this.entities = new EntitiesRepository(db);
    this.relationships = new RelationshipsRepository(db);
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
