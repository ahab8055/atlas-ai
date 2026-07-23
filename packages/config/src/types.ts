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

/** Host OS platform id — matches `@atlas-ai/platform` PlatformId. */
export type AtlasPlatformId = "darwin" | "linux" | "win32";

export interface AtlasPlatformFeatureFlags {
  /** Wrap privileged OS methods with OsPermissionBroker (default true). */
  osPermissionBroker: boolean;
  /** Host should attach PlatformEventPublisher when an EventBus exists (default true). */
  platformEvents: boolean;
}

/**
 * Serializable platform behaviour (ADR-0070).
 * Path layout stays on `paths` / ATLAS_DATA_DIR — not dual-owned here.
 */
export interface AtlasPlatformConfig {
  /**
   * Force adapter for tests / CI. Omit = detect host OS.
   * Prefer config/test.json or ATLAS_PLATFORM_FORCE_ID — not production.json.
   */
  forcePlatformId?: AtlasPlatformId;
  features: AtlasPlatformFeatureFlags;
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

export interface AtlasKnowledgeExtractionConfig {
  /** Master switch for extraction APIs (default true). */
  enabled: boolean;
  /** Minimum candidate confidence to store (default 0.55). */
  minConfidence: number;
  /** Auto-ingest entities after CLI pipeline turns (default true). */
  extractOnRequest: boolean;
}

export interface AtlasKnowledgeRelationshipsConfig {
  /** Auto-link co-mentioned entities after extract (default true). */
  autoLinkOnExtract: boolean;
  /** Bump weight/seenCount on re-link (default true). */
  reinforceOnLink: boolean;
  /** Weight increment per reinforce (default 0.05). */
  reinforceStep: number;
}

export interface AtlasKnowledgeRetrievalConfig {
  /** Max ranked snippets for context (default 8). */
  limit: number;
  /** Drop hits below this hybrid score (default 0.2). */
  minScore: number;
  /** Neighbor expansion depth from lexical seeds (default 2). */
  maxDepth: number;
  /** Recency half-life in ms (default 30 days). */
  recencyHalfLifeMs: number;
}

export interface AtlasKnowledgeConfig {
  extraction: AtlasKnowledgeExtractionConfig;
  relationships: AtlasKnowledgeRelationshipsConfig;
  retrieval: AtlasKnowledgeRetrievalConfig;
}

export interface AtlasProfileLearningConfig {
  /** Master switch for preference learning (default true). */
  enabled: boolean;
  /** Observe/suggest after successful CLI turns (default true). */
  learnOnRequest: boolean;
  /** Minimum candidate confidence (default 0.55). */
  minConfidence: number;
  /** Repeats before opening a suggestion (default 2). */
  minOccurrences: number;
  /** Require user approve before saving learned prefs (default true). */
  requireApproval: boolean;
  /** Opt-in silent write (ADR-0050); skips suggestion queue (default false). */
  autoApply: boolean;
}

export interface AtlasProfileConfig {
  learning: AtlasProfileLearningConfig;
}

export interface AtlasWorkspaceConfig {
  /** Detect project root on CLI startup (default true). */
  autoDetect: boolean;
  /** Upsert detected project into SQLite (default true). */
  rememberOnDetect: boolean;
}

export interface AtlasFilesystemConfig {
  /** Extra ignore patterns (gitignore syntax subset). */
  ignorePatterns: string[];
  /** Honor cascading `.gitignore` files (default true). */
  respectGitignore: boolean;
  /** Honor `.atlasignore` at roots (default true). */
  respectAtlasignore: boolean;
  /** Apply built-in node_modules/temp/build ignores (default true). */
  useBuiltinIgnoreDefaults: boolean;
  /** Single `readFile` window cap in bytes (default 262144). */
  maxReadBytes: number;
  /** Cap for `readFileChunks` chunkSize in bytes (default 262144). */
  maxChunkBytes: number;
  /** Atomic-append rewrite cap in bytes (default 16777216). */
  maxAtomicAppendBytes: number;
}

export interface AtlasContextBuilderConfig {
  /** Max characters in the packaged context text (default 4000). */
  maxChars: number;
  /** Cap on memory snippets (default 5). */
  maxMemorySnippets: number;
  /** Cap on knowledge snippets (default 5). */
  maxKnowledgeSnippets: number;
  /** Cap on prior conversation turns (default 6). */
  maxConversationTurns: number;
  /**
   * When true, CLI scales maxChars from ai.hardware.contextSize
   * (min of configured maxChars and floor(contextSize * 4 * 0.35)).
   */
  scaleToModelContext: boolean;
}

export interface AtlasContextCompressionConfig {
  /** Enable extractive conversation compression (default true). */
  enabled: boolean;
  /** Raw turns kept after compression (default 4). */
  keepRecentTurns: number;
  /** Max extractive summary bullets (default 8). */
  maxSummaryLines: number;
  /** Jaccard threshold for near-duplicate drop (default 0.85). */
  nearDuplicateThreshold: number;
}

export interface AtlasContextConfig {
  builder: AtlasContextBuilderConfig;
  compression: AtlasContextCompressionConfig;
}

/** Non-secret, serializable application settings. */
export interface AtlasAppConfig {
  env: AtlasEnvironment;
  logLevel: LogLevel;
  paths: AtlasPathsConfig;
  server: AtlasServerConfig;
  features: AtlasFeatureFlags;
  platform: AtlasPlatformConfig;
  ai: AtlasAiConfig;
  memory: AtlasMemoryConfig;
  knowledge: AtlasKnowledgeConfig;
  profile: AtlasProfileConfig;
  workspace: AtlasWorkspaceConfig;
  filesystem: AtlasFilesystemConfig;
  context: AtlasContextConfig;
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
