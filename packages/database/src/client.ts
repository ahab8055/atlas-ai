import { mkdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { SCHEMA_SQL, SCHEMA_VERSION } from "./schema.js";

export type SqliteDatabase = DatabaseSync;

export interface OpenDatabaseOptions {
  /**
   * File path, or `:memory:` for ephemeral DBs.
   * Default: `.data/atlas.sqlite` under `process.cwd()`.
   */
  path?: string;
  /** Skip default seed rows (tests). */
  skipSeed?: boolean;
}

export function defaultDatabasePath(cwd: string = process.cwd()): string {
  return resolve(cwd, ".data", "atlas.sqlite");
}

export function resolveDatabasePath(path?: string): string {
  if (!path || path === ":memory:") {
    return path ?? defaultDatabasePath();
  }
  return isAbsolute(path) ? path : resolve(process.cwd(), path);
}

function ensureParentDir(dbPath: string): void {
  if (dbPath === ":memory:") {
    return;
  }
  mkdirSync(dirname(dbPath), { recursive: true });
}

/**
 * Apply schema migrations (idempotent CREATE IF NOT EXISTS + version stamp).
 */
export function migrate(db: SqliteDatabase): number {
  db.exec(SCHEMA_SQL);

  const row = db
    .prepare("SELECT MAX(version) AS version FROM schema_migrations")
    .get() as { version: number | null } | undefined;

  const current = row?.version ?? 0;
  if (current < SCHEMA_VERSION) {
    db.prepare(
      "INSERT OR REPLACE INTO schema_migrations (version, applied_at) VALUES (?, ?)",
    ).run(SCHEMA_VERSION, new Date().toISOString());
  }

  return SCHEMA_VERSION;
}

function seedDefaults(db: SqliteDatabase): void {
  const now = new Date().toISOString();
  const upsertConfig = db.prepare(`
    INSERT INTO system_config (id, key, value, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO NOTHING
  `);

  upsertConfig.run("cfg_app_name", "app.name", "Atlas AI", now);
  upsertConfig.run("cfg_schema", "schema.version", String(SCHEMA_VERSION), now);
  upsertConfig.run("cfg_log_level", "logging.level", "info", now);
  upsertConfig.run("cfg_runtime", "runtime.initialized", "true", now);

  const upsertPref = db.prepare(`
    INSERT INTO user_preferences (id, user_id, key, value, category, created_at, updated_at)
    VALUES (?, 'local', ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, key) DO NOTHING
  `);

  upsertPref.run(
    "pref_editor",
    "preferred_editor",
    "VS Code",
    "editor",
    now,
    now,
  );
  upsertPref.run("pref_theme", "theme", "system", "appearance", now, now);
  upsertPref.run(
    "pref_language",
    "preferred_language",
    "English",
    "general",
    now,
    now,
  );
}

/**
 * Open (or create) the Atlas SQLite database and initialize schema automatically.
 */
export function openDatabase(options: OpenDatabaseOptions = {}): {
  db: SqliteDatabase;
  path: string;
} {
  const path = resolveDatabasePath(options.path);
  ensureParentDir(path);

  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  if (!options.skipSeed) {
    seedDefaults(db);
  }

  return { db, path };
}
