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

/** Non-secret, serializable application settings. */
export interface AtlasAppConfig {
  env: AtlasEnvironment;
  logLevel: LogLevel;
  paths: AtlasPathsConfig;
  server: AtlasServerConfig;
  features: AtlasFeatureFlags;
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
