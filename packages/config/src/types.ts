/**
 * Atlas AI configuration types.
 * Secrets are never part of committed JSON; they live only on `AtlasSecrets`.
 */

export type AtlasEnvironment = "development" | "production" | "test";

export type LogLevel = "error" | "warn" | "info" | "debug" | "trace";

export interface AtlasPathsConfig {
  dataDir: string;
  modelsDir: string;
  databasePath: string;
}

export interface AtlasServerConfig {
  host: string;
  port: number;
}

export interface AtlasFeatureFlags {
  /** Allow optional cloud LLM providers when keys are present. */
  cloudProviders: boolean;
  /** Outbound product telemetry (off by default for privacy-first MVP). */
  telemetry: boolean;
  /**
   * When true (default), block internet-dependent AI ops (URL model install,
   * cloud inference). Local mock / loopback llama.cpp remain allowed.
   */
  offlineMode: boolean;
}

export interface AtlasAiInferenceConfig {
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
  /** Prefer streaming responses when the caller supports it. */
  stream: boolean;
}

export interface AtlasAiHardwareConfig {
  /** cpu (default) | gpu — GPU uses gpuLayers when > 0. */
  acceleration: "cpu" | "gpu";
  /** llama.cpp `-t`; 0 = auto. */
  threads: number;
  /** llama.cpp `-ngl`; 0 = CPU-only. */
  gpuLayers: number;
  contextSize: number;
}

export interface AtlasAiLlamaCppConfig {
  /** Spawn/stop llama-server from Atlas on load. */
  manageServer: boolean;
  /** Binary name or absolute path. */
  binary: string;
}

export interface AtlasAiConfig {
  /** Active inference provider id (`mock` | `llamacpp` | custom). */
  provider: string;
  /** Local llama.cpp / OpenAI-compatible endpoint. */
  endpoint: string;
  /** Default model id for load/generate. */
  defaultModelId: string;
  inference: AtlasAiInferenceConfig;
  hardware: AtlasAiHardwareConfig;
  llamaCpp: AtlasAiLlamaCppConfig;
}

export interface AtlasMemoryShortTermConfig {
  /** Max conversation turns retained per session. */
  maxEntries: number;
  /** Drop turns older than this many ms; 0 disables TTL. */
  ttlMs: number;
}

export interface AtlasMemoryClassificationConfig {
  /** Below this importance → discard (default 0.45). */
  minImportanceToStore: number;
  /** Below this confidence → discard (default 0.35). */
  minConfidenceToStore: number;
  /** TTL for temporary / borderline content (default 24h). */
  temporaryTtlMs: number;
}

export interface AtlasMemoryRetrievalConfig {
  /** Max memories injected into context (default 5). */
  limit: number;
  /** Drop hits below this hybrid score (default 0.15). */
  minScore: number;
  /** Recency half-life in ms (default 30 days). */
  recencyHalfLifeMs: number;
}

export interface AtlasMemoryConsolidationConfig {
  /** Near-duplicate merge threshold (default 0.72). */
  mergeMinScore: number;
  /** Min score to consider conflict detection (default 0.55). */
  conflictMinScore: number;
  /** Max near-neighbors per anchor (default 10). */
  candidateLimit: number;
  /** Merge/update on evaluateAndStore (default true). */
  consolidateOnStore: boolean;
}

export interface AtlasMemoryConfig {
  shortTerm: AtlasMemoryShortTermConfig;
  classification: AtlasMemoryClassificationConfig;
  retrieval: AtlasMemoryRetrievalConfig;
  consolidation: AtlasMemoryConsolidationConfig;
}

/** Non-secret, serializable application settings. */
export interface AtlasAppConfig {
  env: AtlasEnvironment;
  logLevel: LogLevel;
  paths: AtlasPathsConfig;
  server: AtlasServerConfig;
  features: AtlasFeatureFlags;
  ai: AtlasAiConfig;
  memory: AtlasMemoryConfig;
}

/**
 * Sensitive values — sourced only from the environment / future OS keychain.
 * Never persist these into `config/*.json`.
 */
export interface AtlasSecrets {
  openaiApiKey?: string;
  anthropicApiKey?: string;
}

export interface AtlasConfig extends AtlasAppConfig {
  secrets: AtlasSecrets;
}

export interface LoadConfigOptions {
  /** Explicit environment; defaults to ATLAS_ENV or "development". */
  env?: AtlasEnvironment;
  /** Repository root containing `config/` and optional `.env`. */
  repoRoot?: string;
  /** Load gitignored `.env` from repo root (default true). */
  loadEnvFile?: boolean;
  /** Override process.env for tests. */
  envVars?: NodeJS.ProcessEnv;
}
