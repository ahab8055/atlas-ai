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
}

export interface AtlasAiInferenceConfig {
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
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

/** Non-secret, serializable application settings. */
export interface AtlasAppConfig {
  env: AtlasEnvironment;
  logLevel: LogLevel;
  paths: AtlasPathsConfig;
  server: AtlasServerConfig;
  features: AtlasFeatureFlags;
  ai: AtlasAiConfig;
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
