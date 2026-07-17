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

  if (version < SCHEMA_VERSION) {
    db.prepare(
      "INSERT OR REPLACE INTO schema_migrations (version, applied_at) VALUES (?, ?)",
    ).run(SCHEMA_VERSION, new Date().toISOString());
  }
}
