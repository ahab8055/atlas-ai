import type { SqliteDatabase } from "./client.js";
import { SCHEMA_VERSION } from "./schema.js";

function currentVersion(db: SqliteDatabase): number {
  try {
    const row = db
      .prepare("SELECT MAX(version) AS version FROM schema_migrations")
      .get() as { version: number | null } | undefined;
    return row?.version ?? 0;
  } catch {
    return 0;
  }
}

function tableColumns(db: SqliteDatabase, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
  }>;
  return new Set(rows.map((row) => row.name));
}

/**
 * Incremental upgrades for existing DB files (CREATE IF NOT EXISTS does not add columns).
 */
export function applyIncrementalMigrations(db: SqliteDatabase): void {
  const version = currentVersion(db);

  if (version < 2) {
    const columns = tableColumns(db, "execution_history");
    if (!columns.has("failures_json")) {
      db.exec("ALTER TABLE execution_history ADD COLUMN failures_json TEXT");
    }
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_execution_history_status
        ON execution_history(status);
      CREATE INDEX IF NOT EXISTS idx_execution_history_intent
        ON execution_history(intent);
      CREATE INDEX IF NOT EXISTS idx_execution_history_finished
        ON execution_history(finished_at);
    `);
  }

  if (version < 3) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS models (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider TEXT NOT NULL,
        version TEXT,
        format TEXT,
        size INTEGER,
        context_length INTEGER,
        capabilities TEXT,
        requirements TEXT,
        location TEXT,
        status TEXT NOT NULL DEFAULT 'available',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_models_status ON models(status);
      CREATE INDEX IF NOT EXISTS idx_models_provider ON models(provider);
      CREATE INDEX IF NOT EXISTS idx_models_format ON models(format);
    `);
  }

  if (version < 4) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        embedding BLOB NOT NULL,
        dimensions INTEGER NOT NULL,
        model_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        collection TEXT NOT NULL DEFAULT 'general',
        source TEXT,
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_embeddings_collection ON embeddings(collection);
      CREATE INDEX IF NOT EXISTS idx_embeddings_model ON embeddings(model_id);
      CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings(source);
      CREATE INDEX IF NOT EXISTS idx_embeddings_updated ON embeddings(updated_at);
    `);
  }

  if (version < 5) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'local',
        type TEXT NOT NULL CHECK (type IN ('episodic', 'semantic', 'procedural')),
        content TEXT NOT NULL,
        importance REAL,
        confidence REAL,
        source TEXT,
        session_id TEXT,
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id);
      CREATE INDEX IF NOT EXISTS idx_memories_updated ON memories(updated_at);
      CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id);

      CREATE TABLE IF NOT EXISTS memory_tags (
        id TEXT PRIMARY KEY,
        memory_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
        UNIQUE (memory_id, tag)
      );
      CREATE INDEX IF NOT EXISTS idx_memory_tags_tag ON memory_tags(tag);
      CREATE INDEX IF NOT EXISTS idx_memory_tags_memory ON memory_tags(memory_id);
    `);
  }

  if (version < 6) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'local',
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        properties TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (user_id, type, name)
      );
      CREATE INDEX IF NOT EXISTS idx_entities_user_type ON entities(user_id, type);
      CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);

      CREATE TABLE IF NOT EXISTS relationships (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'local',
        from_entity_id TEXT NOT NULL,
        to_entity_id TEXT NOT NULL,
        type TEXT NOT NULL,
        weight REAL,
        properties TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (from_entity_id) REFERENCES entities(id) ON DELETE CASCADE,
        FOREIGN KEY (to_entity_id) REFERENCES entities(id) ON DELETE CASCADE,
        UNIQUE (user_id, from_entity_id, to_entity_id, type)
      );
      CREATE INDEX IF NOT EXISTS idx_relationships_from ON relationships(from_entity_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_to ON relationships(to_entity_id);
      CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type);
      CREATE INDEX IF NOT EXISTS idx_relationships_user ON relationships(user_id);
    `);
  }

  if (version < 7) {
    const columns = tableColumns(db, "user_preferences");
    if (!columns.has("source")) {
      db.exec(
        "ALTER TABLE user_preferences ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'",
      );
    }
    if (!columns.has("confidence")) {
      db.exec(
        "ALTER TABLE user_preferences ADD COLUMN confidence REAL NOT NULL DEFAULT 1",
      );
    }
    if (!columns.has("enabled")) {
      db.exec(
        "ALTER TABLE user_preferences ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1",
      );
    }
  }

  if (version < 8) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'local',
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        repo_url TEXT,
        default_branch TEXT,
        metadata TEXT NOT NULL DEFAULT '{}',
        last_seen_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (user_id, path)
      );
      CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
      CREATE INDEX IF NOT EXISTS idx_projects_last_seen ON projects(last_seen_at);
    `);
    const memCols = tableColumns(db, "memories");
    if (!memCols.has("project_id")) {
      db.exec("ALTER TABLE memories ADD COLUMN project_id TEXT");
    }
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id)",
    );
  }

  if (version < 9) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS preference_observations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'local',
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        count INTEGER NOT NULL DEFAULT 0,
        last_confidence REAL NOT NULL DEFAULT 0,
        last_seen_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE (user_id, key, value)
      );
      CREATE INDEX IF NOT EXISTS idx_pref_obs_user ON preference_observations(user_id);
      CREATE INDEX IF NOT EXISTS idx_pref_obs_key ON preference_observations(user_id, key);

      CREATE TABLE IF NOT EXISTS preference_suggestions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL DEFAULT 'local',
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        confidence REAL NOT NULL,
        observation_count INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'pending',
        reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_pref_sug_user_status
        ON preference_suggestions(user_id, status);
      CREATE INDEX IF NOT EXISTS idx_pref_sug_pending_key
        ON preference_suggestions(user_id, key, status);
    `);
  }

  if (version < 10) {
    const memCols = tableColumns(db, "memories");
    if (!memCols.has("sensitivity")) {
      db.exec(
        "ALTER TABLE memories ADD COLUMN sensitivity TEXT NOT NULL DEFAULT 'normal'",
      );
    }
    if (!memCols.has("encrypted")) {
      db.exec(
        "ALTER TABLE memories ADD COLUMN encrypted INTEGER NOT NULL DEFAULT 0",
      );
    }
    if (!memCols.has("content_nonce")) {
      db.exec("ALTER TABLE memories ADD COLUMN content_nonce TEXT");
    }
    db.exec(
      "CREATE INDEX IF NOT EXISTS idx_memories_sensitivity ON memories(sensitivity)",
    );
  }

  if (version < SCHEMA_VERSION) {
    db.prepare(
      "INSERT OR REPLACE INTO schema_migrations (version, applied_at) VALUES (?, ?)",
    ).run(SCHEMA_VERSION, new Date().toISOString());
  }
}
