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
};
