/**
 * Open EmbeddingService with mock (default) or HTTP llama.cpp embeddings,
 * optionally persisting to SQLite.
 */
import {
  createEmbeddingService,
  createPersistentEmbeddingStore,
  HttpEmbeddingProvider,
  InMemoryEmbeddingStore,
  MockEmbeddingProvider,
  type EmbeddingService,
} from "@atlas-ai/ai";
import { loadConfig } from "@atlas-ai/config";
import { openAtlasDatabase, type AtlasDatabase } from "@atlas-ai/database";

import type { CliOptions } from "./options.js";

export interface EmbeddingSession {
  service: EmbeddingService;
  database?: AtlasDatabase;
  close: () => void;
}

export type EmbeddingCliOptions = Pick<
  CliOptions,
  "enableDatabase" | "databasePath"
>;

export function openEmbeddingSession(
  options: EmbeddingCliOptions = { enableDatabase: true },
): EmbeddingSession {
  const config = loadConfig();
  const useHttp =
    process.env.ATLAS_AI_EMBED_PROVIDER === "llamacpp" ||
    (config.ai.provider === "llamacpp" &&
      process.env.ATLAS_AI_EMBED_PROVIDER !== "mock");

  const provider = useHttp
    ? new HttpEmbeddingProvider({
        baseUrl: config.ai.endpoint,
        defaultModelId: process.env.ATLAS_AI_EMBED_MODEL ?? "nomic-embed-text",
      })
    : new MockEmbeddingProvider();

  const defaultModelId = useHttp
    ? (process.env.ATLAS_AI_EMBED_MODEL ?? "nomic-embed-text")
    : "mock-embed-384";

  if (options.enableDatabase) {
    const database = openAtlasDatabase({ path: options.databasePath });
    const service = createEmbeddingService({
      provider,
      store: createPersistentEmbeddingStore(database.embeddings),
      defaultModelId,
    });
    return {
      service,
      database,
      close: () => database.close(),
    };
  }

  const service = createEmbeddingService({
    provider,
    store: new InMemoryEmbeddingStore(),
    defaultModelId,
  });
  return {
    service,
    close: () => undefined,
  };
}
