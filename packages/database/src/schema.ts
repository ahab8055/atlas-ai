/** Current embedded schema version applied by `initializeDatabase`. */
export const SCHEMA_VERSION = 1;

/**
 * Core runtime tables (Architecture/20) for MVP persistence.
 * Applied automatically on open.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS system_config (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local',
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, key)
);

CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'system',
  version TEXT NOT NULL DEFAULT '1.0.0',
  enabled INTEGER NOT NULL DEFAULT 1,
  configuration TEXT NOT NULL DEFAULT '{}',
  risk TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS execution_history (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  plan_id TEXT,
  request_id TEXT,
  trace_id TEXT,
  intent TEXT,
  goal TEXT,
  status TEXT NOT NULL,
  lifecycle TEXT,
  progress_json TEXT,
  result_json TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_executions (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  task_id TEXT,
  step TEXT NOT NULL,
  status TEXT NOT NULL,
  result TEXT,
  error TEXT,
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (execution_id) REFERENCES execution_history(id)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user
  ON user_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_execution_history_created
  ON execution_history(created_at);

CREATE INDEX IF NOT EXISTS idx_task_executions_execution
  ON task_executions(execution_id);
`;
