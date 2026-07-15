/**
 * Open a ModelRegistry backed by SQLite when the DB is enabled,
 * otherwise in-memory (still can sync from disk for the session).
 */
import {
  createModelRegistry,
  createPersistentModelRegistryStore,
  type ModelRegistry,
} from "@atlas-ai/ai";
import { loadConfig } from "@atlas-ai/config";
import { openAtlasDatabase, type AtlasDatabase } from "@atlas-ai/database";

import type { CliOptions } from "./options.js";

export interface ModelRegistrySession {
  registry: ModelRegistry;
  database?: AtlasDatabase;
  close: () => void;
}

export type ModelRegistryCliOptions = Pick<
  CliOptions,
  "enableDatabase" | "databasePath"
>;

export function openModelRegistrySession(
  options: ModelRegistryCliOptions = { enableDatabase: true },
): ModelRegistrySession {
  const config = loadConfig();
  const modelsDir = config.paths.modelsDir;
  const defaultContextLength = config.ai.hardware.contextSize;
  const defaultProvider =
    config.ai.provider === "mock" ? "llamacpp" : config.ai.provider;

  if (options.enableDatabase) {
    const database = openAtlasDatabase({ path: options.databasePath });
    const registry = createModelRegistry({
      store: createPersistentModelRegistryStore(database.models),
      modelsDir,
      defaultProvider,
      defaultContextLength,
    });
    return {
      registry,
      database,
      close: () => database.close(),
    };
  }

  const registry = createModelRegistry({
    modelsDir,
    defaultProvider,
    defaultContextLength,
  });
  return {
    registry,
    close: () => undefined,
  };
}
