export type {
  EmbedBatchInput,
  EmbedResult,
  EmbedTextInput,
  EmbeddingCollection,
  EmbeddingModelInfo,
  EmbeddingQuery,
  EmbeddingRecord,
  EmbeddingVector,
  FindSimilarOptions,
  SimilarityMatch,
  StoreEmbeddingInput,
} from "./types.js";

export type { EmbeddingProvider, EmbeddingProviderHealth } from "./provider.js";

export type { EmbeddingStore } from "./store.js";

export {
  assertValidVector,
  cosineSimilarity,
  deserializeEmbedding,
  hashTextToVector,
  serializeEmbedding,
} from "./vectors.js";

export { InMemoryEmbeddingStore } from "./memory-store.js";

export {
  createPersistentEmbeddingStore,
  type PersistentEmbeddingRow,
  type PersistentEmbeddingsApi,
} from "./persistent-store.js";

export {
  MockEmbeddingProvider,
  type MockEmbeddingProviderOptions,
} from "./mock.js";

export {
  HttpEmbeddingProvider,
  type HttpEmbeddingProviderOptions,
} from "./http.js";

export {
  EmbeddingService,
  createEmbeddingService,
  type EmbeddingServiceOptions,
} from "./service.js";
