export type {
  ClearMemoryOptions,
  CreateMemoryInput,
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
  toMemorySnippets,
  type MemoryManagerOptions,
} from "./manager.js";

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
