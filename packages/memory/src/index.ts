export type {
  ClearMemoryOptions,
  CreateMemoryInput,
  LongTermMemoryKind,
  MemoryQuery,
  MemoryRecord,
  MemoryScope,
  MemorySnippetView,
  MemoryType,
  UpdateMemoryInput,
} from "./types.js";

export { MEMORY_TYPES, isLongTermType, scopeForType } from "./types.js";

export type { MemoryErrorCode } from "./errors.js";
export { MemoryError } from "./errors.js";

export type { MemoryProvider } from "./provider.js";

export {
  MemoryProviderRegistry,
  getDefaultMemoryProviderRegistry,
  setDefaultMemoryProviderRegistry,
} from "./registry.js";

export {
  InMemoryEpisodicMemoryProvider,
  InMemoryProceduralMemoryProvider,
  InMemorySemanticMemoryProvider,
  InMemoryWorkingMemoryProvider,
} from "./providers/in-memory.js";

export {
  registerBuiltinMemoryProviders,
  type RegisterBuiltinMemoryProvidersOptions,
} from "./providers/register.js";

export {
  MemoryManager,
  createDefaultMemoryManager,
  createMemoryManager,
  createPersistentMemoryManager,
  toMemorySnippets,
  type MemoryManagerOptions,
} from "./manager.js";

export { SqliteMemoryProvider } from "./providers/sqlite.js";
export { registerPersistentMemoryProviders } from "./providers/persistent.js";

export {
  LongTermMemory,
  createLongTermMemory,
  DEFAULT_BACKUP_EXPORT_LIMIT,
  type EvaluateAndStoreExtras,
  type EvaluateAndStoreResult,
  type ExportBackupOptions,
  type ImportBackupOptions,
  type LongTermListOptions,
  type LongTermMemoryOptions,
  type LongTermSearchOptions,
} from "./long-term/index.js";

export type {
  ClassificationAction,
  ClassificationThresholds,
  MemoryClassificationInput,
  MemoryClassificationResult,
  MemoryDurability,
  SuggestedMemoryType,
  PurgeExpiredResult,
} from "./classification/index.js";

export {
  DEFAULT_CLASSIFICATION_THRESHOLDS,
  classifyMemory,
  createExpirationPolicy,
  purgeExpiredMemories,
  resolveAction,
  resolveExpiresAt,
  shouldPersist,
} from "./classification/index.js";

export type {
  MemoryEmbeddingLookup,
  RetrievalOptions,
  RetrievalScoreWeights,
  RetrievedMemory,
  ScoreBreakdown,
} from "./retrieval/index.js";

export {
  DEFAULT_RECENCY_HALF_LIFE_MS,
  DEFAULT_RETRIEVAL_LIMIT,
  DEFAULT_RETRIEVAL_MIN_SCORE,
  DEFAULT_RETRIEVAL_WEIGHTS,
  MemoryRetrievalEngine,
  createMemoryRetrievalEngine,
  cosineSimilarity,
  hashTextToVector,
} from "./retrieval/index.js";

export type {
  MemorySearchHit,
  MemorySearchMode,
  MemorySearchQuery,
  MemorySearchResult,
  MemorySearchApiOptions,
} from "./search/index.js";

export {
  KEYWORD_SEARCH_WEIGHTS,
  SEMANTIC_SEARCH_WEIGHTS,
  MemorySearchApi,
  createMemorySearchApi,
  toRetrievalOptions,
  weightsForMode,
} from "./search/index.js";

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
} from "./consolidation/index.js";

export {
  DEFAULT_CONSOLIDATION_THRESHOLDS,
  consolidateAgainstText,
  consolidateMemories,
  detectContradiction,
  mergeThresholds,
  pairSimilarity,
  readConflict,
  readHistory,
} from "./consolidation/index.js";

export type {
  ConversationStoreAdapter,
  ShortTermMemoryConfig,
  ShortTermMemoryOptions,
  ShortTermRole,
  ShortTermTurn,
} from "./short-term/types.js";

export {
  DEFAULT_SHORT_TERM_MAX_ENTRIES,
  DEFAULT_SHORT_TERM_TTL_MS,
} from "./short-term/types.js";

export { ShortTermMemory, createShortTermMemory } from "./short-term/index.js";

export type {
  MemoryAccessAction,
  MemoryAccessEvent,
  MemoryCrypto,
  MemoryDekProvider,
  MemorySensitivity,
} from "./security/index.js";

export {
  MemoryAccessLog,
  auditMemoryAccess,
  createMemoryCrypto,
  createStaticDekProvider,
  looksLikeSecretContent,
  requireMemoryPermission,
} from "./security/index.js";

export type {
  BackupValidationResult,
  ImportBackupMode,
  ImportBackupResult,
  MemoryBackupEnvelope,
  MemoryBackupRecord,
  MemoryBackupSnapshot,
} from "./backup/index.js";

export {
  MEMORY_BACKUP_ENCRYPTED_FORMAT,
  MEMORY_BACKUP_FORMAT,
  MEMORY_BACKUP_VERSION,
  buildSnapshot,
  computeChecksum,
  decryptBackup,
  encryptBackup,
  isBackupEnvelope,
  parseBackupJson,
  validateSnapshot,
} from "./backup/index.js";

export type {
  ConsolidationSnapshot,
  MemoryAnalyticsMonitorOptions,
  MemoryProcessMetrics,
  MemoryRetrievalSample,
  MemoryStatsReport,
  TimingStats,
} from "./analytics/index.js";

export {
  DEFAULT_SLOW_RETRIEVAL_MS,
  MemoryAnalyticsMonitor,
  createMemoryAnalyticsMonitor,
  formatMemoryStats,
} from "./analytics/index.js";
