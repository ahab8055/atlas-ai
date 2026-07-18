/** Current embedded schema version applied by `migrate`. */
export const SCHEMA_VERSION = 10;

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
  source TEXT NOT NULL DEFAULT 'manual',
  confidence REAL NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1,
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
  failures_json TEXT,
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

CREATE INDEX IF NOT EXISTS idx_execution_history_status
  ON execution_history(status);

CREATE INDEX IF NOT EXISTS idx_execution_history_intent
  ON execution_history(intent);

CREATE INDEX IF NOT EXISTS idx_execution_history_finished
  ON execution_history(finished_at);

CREATE INDEX IF NOT EXISTS idx_task_executions_execution
  ON task_executions(execution_id);

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

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'local',
  type TEXT NOT NULL CHECK (type IN ('episodic', 'semantic', 'procedural')),
  content TEXT NOT NULL,
  importance REAL,
  confidence REAL,
  source TEXT,
  session_id TEXT,
  project_id TEXT,
  sensitivity TEXT NOT NULL DEFAULT 'normal'
    CHECK (sensitivity IN ('normal', 'sensitive')),
  encrypted INTEGER NOT NULL DEFAULT 0,
  content_nonce TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_updated ON memories(updated_at);
CREATE INDEX IF NOT EXISTS idx_memories_session ON memories(session_id);
CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id);

CREATE TABLE IF NOT EXISTS memory_tags (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
  UNIQUE (memory_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_memory_tags_tag ON memory_tags(tag);
CREATE INDEX IF NOT EXISTS idx_memory_tags_memory ON memory_tags(memory_id);

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
`;
