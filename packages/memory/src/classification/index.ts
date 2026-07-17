export type {
  ClassificationAction,
  ClassificationThresholds,
  MemoryClassificationInput,
  MemoryClassificationResult,
  MemoryDurability,
  SuggestedMemoryType,
} from "./types.js";

export { DEFAULT_CLASSIFICATION_THRESHOLDS } from "./types.js";

export { classifyMemory, type ClassifyMemoryOptions } from "./classify.js";

export {
  createExpirationPolicy,
  resolveAction,
  resolveExpiresAt,
  shouldPersist,
  type ActionSignals,
  type ExpireSignals,
  type MemoryExpirationPolicy,
} from "./policy.js";

export { purgeExpiredMemories, type PurgeExpiredResult } from "./purge.js";
