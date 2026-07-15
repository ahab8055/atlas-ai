import type {
  AtlasAiConfig,
  AtlasAppConfig,
  AtlasEnvironment,
  AtlasFeatureFlags,
  AtlasPathsConfig,
  AtlasServerConfig,
  LogLevel,
} from "./types.js";
import { DEFAULT_APP_CONFIG } from "./defaults.js";

const ENVIRONMENTS: readonly AtlasEnvironment[] = [
  "development",
  "production",
  "test",
] as const;

const LOG_LEVELS: readonly LogLevel[] = [
  "error",
  "warn",
  "info",
  "debug",
  "trace",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asEnvironment(
  value: unknown,
  fallback: AtlasEnvironment,
): AtlasEnvironment {
  return typeof value === "string" &&
    (ENVIRONMENTS as readonly string[]).includes(value)
    ? (value as AtlasEnvironment)
    : fallback;
}

function asLogLevel(value: unknown, fallback: LogLevel): LogLevel {
  return typeof value === "string" &&
    (LOG_LEVELS as readonly string[]).includes(value)
    ? (value as LogLevel)
    : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asPort(value: unknown, fallback: number): number {
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value > 0 &&
    value < 65536
  ) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return asPort(Number(value), fallback);
  }
  return fallback;
}

function mergePaths(base: AtlasPathsConfig, patch: unknown): AtlasPathsConfig {
  if (!isRecord(patch)) {
    return { ...base };
  }
  return {
    dataDir: asString(patch.dataDir, base.dataDir),
    modelsDir: asString(patch.modelsDir, base.modelsDir),
    databasePath: asString(patch.databasePath, base.databasePath),
  };
}

function mergeServer(
  base: AtlasServerConfig,
  patch: unknown,
): AtlasServerConfig {
  if (!isRecord(patch)) {
    return { ...base };
  }
  return {
    host: asString(patch.host, base.host),
    port: asPort(patch.port, base.port),
  };
}

function mergeFeatures(
  base: AtlasFeatureFlags,
  patch: unknown,
): AtlasFeatureFlags {
  if (!isRecord(patch)) {
    return { ...base };
  }
  return {
    cloudProviders: asBoolean(patch.cloudProviders, base.cloudProviders),
    telemetry: asBoolean(patch.telemetry, base.telemetry),
  };
}

function mergeAi(base: AtlasAiConfig, patch: unknown): AtlasAiConfig {
  if (!isRecord(patch)) {
    return { ...base };
  }
  return {
    provider: asString(patch.provider, base.provider),
    endpoint: asString(patch.endpoint, base.endpoint),
    defaultModelId: asString(patch.defaultModelId, base.defaultModelId),
  };
}

/** Deep-merge a partial JSON object onto defaults (non-secret fields only). */
export function mergeAppConfig(
  base: AtlasAppConfig,
  patch: unknown,
): AtlasAppConfig {
  if (!isRecord(patch)) {
    return {
      ...base,
      paths: { ...base.paths },
      server: { ...base.server },
      features: { ...base.features },
      ai: { ...base.ai },
    };
  }

  return {
    env: asEnvironment(patch.env, base.env),
    logLevel: asLogLevel(patch.logLevel, base.logLevel),
    paths: mergePaths(base.paths, patch.paths),
    server: mergeServer(base.server, patch.server),
    features: mergeFeatures(base.features, patch.features),
    ai: mergeAi(base.ai, patch.ai),
  };
}

export function parseEnvironment(value: string | undefined): AtlasEnvironment {
  return asEnvironment(value, "development");
}

/** Apply ATLAS_* (and related) environment variable overrides. */
export function applyEnvOverrides(
  config: AtlasAppConfig,
  envVars: NodeJS.ProcessEnv,
): AtlasAppConfig {
  const next = mergeAppConfig(config, {
    env: envVars.ATLAS_ENV ?? config.env,
    logLevel: envVars.ATLAS_LOG_LEVEL ?? config.logLevel,
    paths: {
      dataDir: envVars.ATLAS_DATA_DIR ?? config.paths.dataDir,
      modelsDir: envVars.ATLAS_MODELS_DIR ?? config.paths.modelsDir,
      databasePath: envVars.ATLAS_DATABASE_PATH ?? config.paths.databasePath,
    },
    server: {
      host: envVars.ATLAS_HOST ?? config.server.host,
      port: envVars.ATLAS_PORT ?? config.server.port,
    },
    features: {
      cloudProviders:
        envVars.ATLAS_FEATURE_CLOUD_PROVIDERS !== undefined
          ? envVars.ATLAS_FEATURE_CLOUD_PROVIDERS === "true"
          : config.features.cloudProviders,
      telemetry:
        envVars.ATLAS_FEATURE_TELEMETRY !== undefined
          ? envVars.ATLAS_FEATURE_TELEMETRY === "true"
          : config.features.telemetry,
    },
    ai: {
      provider: envVars.ATLAS_AI_PROVIDER ?? config.ai.provider,
      endpoint: envVars.ATLAS_AI_ENDPOINT ?? config.ai.endpoint,
      defaultModelId:
        envVars.ATLAS_AI_DEFAULT_MODEL ?? config.ai.defaultModelId,
    },
  });

  return next;
}

export function readSecrets(envVars: NodeJS.ProcessEnv) {
  return {
    openaiApiKey: emptyToUndefined(envVars.OPENAI_API_KEY),
    anthropicApiKey: emptyToUndefined(envVars.ANTHROPIC_API_KEY),
  };
}

function emptyToUndefined(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === "") {
    return undefined;
  }
  return value;
}

export { DEFAULT_APP_CONFIG };
