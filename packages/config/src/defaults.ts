import type { AtlasAppConfig } from "./types.js";

/** Fallback defaults when an environment file is missing or incomplete. */
export const DEFAULT_APP_CONFIG: AtlasAppConfig = {
  env: "development",
  logLevel: "info",
  paths: {
    dataDir: ".data",
    modelsDir: "models",
    databasePath: ".data/atlas.db",
  },
  server: {
    host: "127.0.0.1",
    port: 7420,
  },
  features: {
    cloudProviders: false,
    telemetry: false,
    offlineMode: true,
  },
  ai: {
    provider: "mock",
    endpoint: "http://127.0.0.1:8080",
    defaultModelId: "mock-general",
    inference: {
      temperature: 0.7,
      maxTokens: 256,
      topP: 0.9,
      topK: 40,
      repeatPenalty: 1.1,
      stream: true,
    },
    hardware: {
      acceleration: "cpu",
      threads: 0,
      gpuLayers: 0,
      contextSize: 4096,
    },
    llamaCpp: {
      manageServer: false,
      binary: "llama-server",
    },
  },
  memory: {
    shortTerm: {
      maxEntries: 50,
      ttlMs: 1_800_000,
    },
    classification: {
      minImportanceToStore: 0.45,
      minConfidenceToStore: 0.35,
      temporaryTtlMs: 86_400_000,
    },
    retrieval: {
      limit: 5,
      minScore: 0.15,
      recencyHalfLifeMs: 2_592_000_000,
    },
    consolidation: {
      mergeMinScore: 0.72,
      conflictMinScore: 0.55,
      candidateLimit: 10,
      consolidateOnStore: true,
    },
  },
  knowledge: {
    extraction: {
      enabled: true,
      minConfidence: 0.55,
      extractOnRequest: true,
    },
    relationships: {
      autoLinkOnExtract: true,
      reinforceOnLink: true,
      reinforceStep: 0.05,
    },
    retrieval: {
      limit: 8,
      minScore: 0.2,
      maxDepth: 2,
      recencyHalfLifeMs: 2_592_000_000,
    },
  },
  profile: {
    learning: {
      enabled: true,
      learnOnRequest: true,
      minConfidence: 0.55,
      minOccurrences: 2,
      requireApproval: true,
      autoApply: false,
    },
  },
  workspace: {
    autoDetect: true,
    rememberOnDetect: true,
  },
  context: {
    builder: {
      maxChars: 4000,
      maxMemorySnippets: 5,
      maxKnowledgeSnippets: 5,
      maxConversationTurns: 6,
      scaleToModelContext: true,
    },
    compression: {
      enabled: true,
      keepRecentTurns: 4,
      maxSummaryLines: 8,
      nearDuplicateThreshold: 0.85,
    },
  },
};
