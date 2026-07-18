export type {
  KnowledgeRetrievalOptions,
  KnowledgeRetrievalWeights,
  KnowledgeScoreBreakdown,
  RetrievedEntity,
} from "./types.js";

export {
  DEFAULT_KNOWLEDGE_RECENCY_HALF_LIFE_MS,
  DEFAULT_KNOWLEDGE_RETRIEVAL_LIMIT,
  DEFAULT_KNOWLEDGE_RETRIEVAL_MAX_DEPTH,
  DEFAULT_KNOWLEDGE_RETRIEVAL_MIN_SCORE,
  DEFAULT_KNOWLEDGE_RETRIEVAL_WEIGHTS,
} from "./types.js";

export {
  graphHopScore,
  isEntityNameMatch,
  lexicalEntityScore,
  mergeKnowledgeWeights,
  recencyScore,
  scoreRetrievedEntity,
  tokenizeQuery,
} from "./score.js";

export {
  KnowledgeRetrievalEngine,
  createKnowledgeRetrievalEngine,
} from "./engine.js";

export { retrievedToSnippet, toRankedKnowledgeSnippets } from "./snippets.js";
