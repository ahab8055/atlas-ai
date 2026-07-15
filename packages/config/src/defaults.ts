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
};
