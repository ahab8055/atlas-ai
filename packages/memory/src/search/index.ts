export type {
  MemorySearchHit,
  MemorySearchMode,
  MemorySearchQuery,
  MemorySearchResult,
  MemorySearchApiOptions,
} from "./api.js";

export {
  KEYWORD_SEARCH_WEIGHTS,
  SEMANTIC_SEARCH_WEIGHTS,
  MemorySearchApi,
  createMemorySearchApi,
  toRetrievalOptions,
  weightsForMode,
} from "./api.js";
