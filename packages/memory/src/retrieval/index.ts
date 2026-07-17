export type {
  MemoryEmbeddingLookup,
  RetrievalOptions,
  RetrievalScoreWeights,
  RetrievedMemory,
  ScoreBreakdown,
} from "./types.js";

export {
  DEFAULT_RECENCY_HALF_LIFE_MS,
  DEFAULT_RETRIEVAL_LIMIT,
  DEFAULT_RETRIEVAL_MIN_SCORE,
  DEFAULT_RETRIEVAL_WEIGHTS,
  DEFAULT_VECTOR_DIMENSIONS,
} from "./types.js";

export {
  MemoryRetrievalEngine,
  createMemoryRetrievalEngine,
  type MemoryRetrievalEngineOptions,
} from "./engine.js";

export {
  buildQueryVector,
  lexicalScore,
  mergeWeights,
  recencyScore,
  scoreCandidate,
  semanticScore,
  tokenizeQuery,
} from "./score.js";

export { cosineSimilarity, hashTextToVector } from "./vectors.js";
