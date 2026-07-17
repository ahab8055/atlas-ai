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
  },
};
