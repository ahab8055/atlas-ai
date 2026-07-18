import type {
  AtlasAiConfig,
  AtlasAiHardwareConfig,
  AtlasAiInferenceConfig,
  AtlasAiLlamaCppConfig,
  AtlasAppConfig,
  AtlasEnvironment,
  AtlasFeatureFlags,
  AtlasKnowledgeConfig,
  AtlasKnowledgeExtractionConfig,
  AtlasKnowledgeRelationshipsConfig,
  AtlasMemoryClassificationConfig,
  AtlasMemoryConfig,
  AtlasMemoryConsolidationConfig,
  AtlasMemoryRetrievalConfig,
  AtlasMemoryShortTermConfig,
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
    offlineMode: asBoolean(patch.offlineMode, base.offlineMode),
  };
}

function asNumber(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    !Number.isNaN(Number(value))
  ) {
    return Number(value);
  }
  return fallback;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

function mergeInference(
  base: AtlasAiInferenceConfig,
  patch: unknown,
): AtlasAiInferenceConfig {
  if (!isRecord(patch)) {
    return { ...base };
  }
  return {
    temperature: asNumber(patch.temperature, base.temperature),
    maxTokens: asNumber(patch.maxTokens, base.maxTokens),
    topP: asNumber(patch.topP, base.topP),
    topK: asNumber(patch.topK, base.topK),
    repeatPenalty: asNumber(patch.repeatPenalty, base.repeatPenalty),
    stream: asBoolean(patch.stream, base.stream),
  };
}

function mergeHardware(
  base: AtlasAiHardwareConfig,
  patch: unknown,
): AtlasAiHardwareConfig {
  if (!isRecord(patch)) {
    return { ...base };
  }
  const acceleration =
    patch.acceleration === "gpu" || patch.acceleration === "cpu"
      ? patch.acceleration
      : base.acceleration;
  return {
    acceleration,
    threads: asNumber(patch.threads, base.threads),
    gpuLayers: asNumber(patch.gpuLayers, base.gpuLayers),
    contextSize: asNumber(patch.contextSize, base.contextSize),
  };
}

function mergeLlamaCpp(
  base: AtlasAiLlamaCppConfig,
  patch: unknown,
): AtlasAiLlamaCppConfig {
  if (!isRecord(patch)) {
    return { ...base };
  }
  return {
    manageServer: asBoolean(patch.manageServer, base.manageServer),
    binary: asString(patch.binary, base.binary),
  };
}

function mergeAi(base: AtlasAiConfig, patch: unknown): AtlasAiConfig {
  if (!isRecord(patch)) {
    return {
      ...base,
      inference: { ...base.inference },
      hardware: { ...base.hardware },
      llamaCpp: { ...base.llamaCpp },
    };
  }
  return {
    provider: asString(patch.provider, base.provider),
    endpoint: asString(patch.endpoint, base.endpoint),
    defaultModelId: asString(patch.defaultModelId, base.defaultModelId),
    inference: mergeInference(base.inference, patch.inference),
    hardware: mergeHardware(base.hardware, patch.hardware),
    llamaCpp: mergeLlamaCpp(base.llamaCpp, patch.llamaCpp),
  };
}

function mergeMemoryShortTerm(
  base: AtlasMemoryShortTermConfig,
  patch: unknown,
): AtlasMemoryShortTermConfig {
  if (!isRecord(patch)) {
    return { ...base };
  }
  return {
    maxEntries: Math.max(
      1,
      Math.floor(asNumber(patch.maxEntries, base.maxEntries)),
    ),
    ttlMs: Math.max(0, Math.floor(asNumber(patch.ttlMs, base.ttlMs))),
  };
}

function mergeMemoryClassification(
  base: AtlasMemoryClassificationConfig,
  patch: unknown,
): AtlasMemoryClassificationConfig {
  if (!isRecord(patch)) {
    return { ...base };
  }
  return {
    minImportanceToStore: clamp01(
      asNumber(patch.minImportanceToStore, base.minImportanceToStore),
    ),
    minConfidenceToStore: clamp01(
      asNumber(patch.minConfidenceToStore, base.minConfidenceToStore),
    ),
    temporaryTtlMs: Math.max(
      0,
      Math.floor(asNumber(patch.temporaryTtlMs, base.temporaryTtlMs)),
    ),
  };
}

function mergeMemoryRetrieval(
  base: AtlasMemoryRetrievalConfig,
  patch: unknown,
): AtlasMemoryRetrievalConfig {
  if (!isRecord(patch)) {
    return { ...base };
  }
  return {
    limit: Math.max(1, Math.floor(asNumber(patch.limit, base.limit))),
    minScore: clamp01(asNumber(patch.minScore, base.minScore)),
    recencyHalfLifeMs: Math.max(
      1,
      Math.floor(asNumber(patch.recencyHalfLifeMs, base.recencyHalfLifeMs)),
    ),
  };
}

function mergeMemoryConsolidation(
  base: AtlasMemoryConsolidationConfig,
  patch: unknown,
): AtlasMemoryConsolidationConfig {
  if (!isRecord(patch)) {
    return { ...base };
  }
  return {
    mergeMinScore: clamp01(asNumber(patch.mergeMinScore, base.mergeMinScore)),
    conflictMinScore: clamp01(
      asNumber(patch.conflictMinScore, base.conflictMinScore),
    ),
    candidateLimit: Math.max(
      1,
      Math.floor(asNumber(patch.candidateLimit, base.candidateLimit)),
    ),
    consolidateOnStore: asBoolean(
      patch.consolidateOnStore,
      base.consolidateOnStore,
    ),
  };
}

function mergeMemory(
  base: AtlasMemoryConfig,
  patch: unknown,
): AtlasMemoryConfig {
  if (!isRecord(patch)) {
    return {
      shortTerm: { ...base.shortTerm },
      classification: { ...base.classification },
      retrieval: { ...base.retrieval },
      consolidation: { ...base.consolidation },
    };
  }
  return {
    shortTerm: mergeMemoryShortTerm(base.shortTerm, patch.shortTerm),
    classification: mergeMemoryClassification(
      base.classification,
      patch.classification,
    ),
    retrieval: mergeMemoryRetrieval(base.retrieval, patch.retrieval),
    consolidation: mergeMemoryConsolidation(
      base.consolidation,
      patch.consolidation,
    ),
  };
}

function mergeKnowledgeExtraction(
  base: AtlasKnowledgeExtractionConfig,
  patch: unknown,
): AtlasKnowledgeExtractionConfig {
  if (!isRecord(patch)) {
    return { ...base };
  }
  return {
    enabled: asBoolean(patch.enabled, base.enabled),
    minConfidence: asNumber(patch.minConfidence, base.minConfidence),
    extractOnRequest: asBoolean(patch.extractOnRequest, base.extractOnRequest),
  };
}

function mergeKnowledgeRelationships(
  base: AtlasKnowledgeRelationshipsConfig,
  patch: unknown,
): AtlasKnowledgeRelationshipsConfig {
  if (!isRecord(patch)) {
    return { ...base };
  }
  return {
    autoLinkOnExtract: asBoolean(
      patch.autoLinkOnExtract,
      base.autoLinkOnExtract,
    ),
    reinforceOnLink: asBoolean(patch.reinforceOnLink, base.reinforceOnLink),
    reinforceStep: asNumber(patch.reinforceStep, base.reinforceStep),
  };
}

function mergeKnowledge(
  base: AtlasKnowledgeConfig,
  patch: unknown,
): AtlasKnowledgeConfig {
  if (!isRecord(patch)) {
    return {
      extraction: { ...base.extraction },
      relationships: { ...base.relationships },
    };
  }
  return {
    extraction: mergeKnowledgeExtraction(base.extraction, patch.extraction),
    relationships: mergeKnowledgeRelationships(
      base.relationships,
      patch.relationships,
    ),
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
      ai: mergeAi(base.ai, undefined),
      memory: mergeMemory(base.memory, undefined),
      knowledge: mergeKnowledge(base.knowledge, undefined),
    };
  }

  return {
    env: asEnvironment(patch.env, base.env),
    logLevel: asLogLevel(patch.logLevel, base.logLevel),
    paths: mergePaths(base.paths, patch.paths),
    server: mergeServer(base.server, patch.server),
    features: mergeFeatures(base.features, patch.features),
    ai: mergeAi(base.ai, patch.ai),
    memory: mergeMemory(base.memory, patch.memory),
    knowledge: mergeKnowledge(base.knowledge, patch.knowledge),
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
      offlineMode:
        envVars.ATLAS_FEATURE_OFFLINE_MODE !== undefined
          ? envVars.ATLAS_FEATURE_OFFLINE_MODE === "true"
          : config.features.offlineMode,
    },
    ai: {
      provider: envVars.ATLAS_AI_PROVIDER ?? config.ai.provider,
      endpoint: envVars.ATLAS_AI_ENDPOINT ?? config.ai.endpoint,
      defaultModelId:
        envVars.ATLAS_AI_DEFAULT_MODEL ?? config.ai.defaultModelId,
      inference: {
        temperature:
          envVars.ATLAS_AI_TEMPERATURE !== undefined
            ? Number(envVars.ATLAS_AI_TEMPERATURE)
            : config.ai.inference.temperature,
        maxTokens:
          envVars.ATLAS_AI_MAX_TOKENS !== undefined
            ? Number(envVars.ATLAS_AI_MAX_TOKENS)
            : config.ai.inference.maxTokens,
        topP: config.ai.inference.topP,
        topK: config.ai.inference.topK,
        repeatPenalty: config.ai.inference.repeatPenalty,
        stream:
          envVars.ATLAS_AI_STREAM !== undefined
            ? envVars.ATLAS_AI_STREAM === "true"
            : config.ai.inference.stream,
      },
      hardware: {
        acceleration:
          envVars.ATLAS_AI_ACCELERATION === "gpu" ||
          envVars.ATLAS_AI_ACCELERATION === "cpu"
            ? envVars.ATLAS_AI_ACCELERATION
            : config.ai.hardware.acceleration,
        threads:
          envVars.ATLAS_AI_THREADS !== undefined
            ? Number(envVars.ATLAS_AI_THREADS)
            : config.ai.hardware.threads,
        gpuLayers:
          envVars.ATLAS_AI_GPU_LAYERS !== undefined
            ? Number(envVars.ATLAS_AI_GPU_LAYERS)
            : config.ai.hardware.gpuLayers,
        contextSize:
          envVars.ATLAS_AI_CONTEXT_SIZE !== undefined
            ? Number(envVars.ATLAS_AI_CONTEXT_SIZE)
            : config.ai.hardware.contextSize,
      },
      llamaCpp: {
        manageServer:
          envVars.ATLAS_AI_MANAGE_SERVER !== undefined
            ? envVars.ATLAS_AI_MANAGE_SERVER === "true"
            : config.ai.llamaCpp.manageServer,
        binary: envVars.ATLAS_AI_LLAMA_BINARY ?? config.ai.llamaCpp.binary,
      },
    },
    memory: {
      shortTerm: {
        maxEntries:
          envVars.ATLAS_MEMORY_SHORT_TERM_MAX_ENTRIES !== undefined
            ? Number(envVars.ATLAS_MEMORY_SHORT_TERM_MAX_ENTRIES)
            : config.memory.shortTerm.maxEntries,
        ttlMs:
          envVars.ATLAS_MEMORY_SHORT_TERM_TTL_MS !== undefined
            ? Number(envVars.ATLAS_MEMORY_SHORT_TERM_TTL_MS)
            : config.memory.shortTerm.ttlMs,
      },
      classification: {
        minImportanceToStore:
          envVars.ATLAS_MEMORY_CLASSIFY_MIN_IMPORTANCE !== undefined
            ? Number(envVars.ATLAS_MEMORY_CLASSIFY_MIN_IMPORTANCE)
            : config.memory.classification.minImportanceToStore,
        minConfidenceToStore:
          envVars.ATLAS_MEMORY_CLASSIFY_MIN_CONFIDENCE !== undefined
            ? Number(envVars.ATLAS_MEMORY_CLASSIFY_MIN_CONFIDENCE)
            : config.memory.classification.minConfidenceToStore,
        temporaryTtlMs:
          envVars.ATLAS_MEMORY_CLASSIFY_TEMPORARY_TTL_MS !== undefined
            ? Number(envVars.ATLAS_MEMORY_CLASSIFY_TEMPORARY_TTL_MS)
            : config.memory.classification.temporaryTtlMs,
      },
      retrieval: {
        limit:
          envVars.ATLAS_MEMORY_RETRIEVAL_LIMIT !== undefined
            ? Number(envVars.ATLAS_MEMORY_RETRIEVAL_LIMIT)
            : config.memory.retrieval.limit,
        minScore:
          envVars.ATLAS_MEMORY_RETRIEVAL_MIN_SCORE !== undefined
            ? Number(envVars.ATLAS_MEMORY_RETRIEVAL_MIN_SCORE)
            : config.memory.retrieval.minScore,
        recencyHalfLifeMs:
          envVars.ATLAS_MEMORY_RETRIEVAL_RECENCY_HALFLIFE_MS !== undefined
            ? Number(envVars.ATLAS_MEMORY_RETRIEVAL_RECENCY_HALFLIFE_MS)
            : config.memory.retrieval.recencyHalfLifeMs,
      },
      consolidation: {
        mergeMinScore:
          envVars.ATLAS_MEMORY_CONSOLIDATE_MERGE_MIN_SCORE !== undefined
            ? Number(envVars.ATLAS_MEMORY_CONSOLIDATE_MERGE_MIN_SCORE)
            : config.memory.consolidation.mergeMinScore,
        conflictMinScore:
          envVars.ATLAS_MEMORY_CONSOLIDATE_CONFLICT_MIN_SCORE !== undefined
            ? Number(envVars.ATLAS_MEMORY_CONSOLIDATE_CONFLICT_MIN_SCORE)
            : config.memory.consolidation.conflictMinScore,
        candidateLimit:
          envVars.ATLAS_MEMORY_CONSOLIDATE_CANDIDATE_LIMIT !== undefined
            ? Number(envVars.ATLAS_MEMORY_CONSOLIDATE_CANDIDATE_LIMIT)
            : config.memory.consolidation.candidateLimit,
        consolidateOnStore:
          envVars.ATLAS_MEMORY_CONSOLIDATE_ON_STORE !== undefined
            ? envVars.ATLAS_MEMORY_CONSOLIDATE_ON_STORE === "true"
            : config.memory.consolidation.consolidateOnStore,
      },
    },
    knowledge: {
      extraction: {
        enabled:
          envVars.ATLAS_KNOWLEDGE_EXTRACTION_ENABLED !== undefined
            ? envVars.ATLAS_KNOWLEDGE_EXTRACTION_ENABLED === "true"
            : config.knowledge.extraction.enabled,
        minConfidence:
          envVars.ATLAS_KNOWLEDGE_EXTRACTION_MIN_CONFIDENCE !== undefined
            ? Number(envVars.ATLAS_KNOWLEDGE_EXTRACTION_MIN_CONFIDENCE)
            : config.knowledge.extraction.minConfidence,
        extractOnRequest:
          envVars.ATLAS_KNOWLEDGE_EXTRACT_ON_REQUEST !== undefined
            ? envVars.ATLAS_KNOWLEDGE_EXTRACT_ON_REQUEST === "true"
            : config.knowledge.extraction.extractOnRequest,
      },
      relationships: {
        autoLinkOnExtract:
          envVars.ATLAS_KNOWLEDGE_AUTO_LINK_ON_EXTRACT !== undefined
            ? envVars.ATLAS_KNOWLEDGE_AUTO_LINK_ON_EXTRACT === "true"
            : config.knowledge.relationships.autoLinkOnExtract,
        reinforceOnLink:
          envVars.ATLAS_KNOWLEDGE_REINFORCE_ON_LINK !== undefined
            ? envVars.ATLAS_KNOWLEDGE_REINFORCE_ON_LINK === "true"
            : config.knowledge.relationships.reinforceOnLink,
        reinforceStep:
          envVars.ATLAS_KNOWLEDGE_REINFORCE_STEP !== undefined
            ? Number(envVars.ATLAS_KNOWLEDGE_REINFORCE_STEP)
            : config.knowledge.relationships.reinforceStep,
      },
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
