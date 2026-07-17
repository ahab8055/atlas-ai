export type {
  ConsolidateAgainstOptions,
  ConsolidateAgainstResult,
  ConsolidateOptions,
  ConsolidationAction,
  ConsolidationDecision,
  ConsolidationPairResult,
  ConsolidationResult,
  ConsolidationThresholds,
  MemoryConflictMeta,
  MemoryHistoryEntry,
} from "./types.js";

export { DEFAULT_CONSOLIDATION_THRESHOLDS } from "./types.js";

export {
  chooseSurvivor,
  detectContradiction,
  isNearDuplicate,
  mergeThresholds,
  pairSimilarity,
} from "./detect.js";

export {
  buildConflictMetadata,
  buildMergePatch,
  mergeMetadata,
  readConflict,
  readConsolidatedFrom,
  readHistory,
} from "./merge.js";

export {
  consolidateAgainstText,
  consolidateMemories,
  type ConsolidationStore,
} from "./consolidate.js";
