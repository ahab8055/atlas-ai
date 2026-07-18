export type {
  ActiveTask,
  ContextContribution,
  ContextLoadInput,
  ContextPackage,
  ContextPackageStats,
  ContextProvider,
  ContextSection,
  ContextSectionKind,
  ContextSourceId,
  ConversationContext,
  ConversationRole,
  ConversationTurn,
  KnowledgeSnippet,
  LoadedContext,
  MemorySnippet,
  ProjectContext,
  SystemStateInfo,
  UserPreferences,
} from "./types.js";

export {
  InMemoryConversationStore,
  summarizeConversation,
  type ConversationStore,
  type InMemoryConversationStoreOptions,
} from "./conversation-store.js";

export {
  InMemoryPreferenceStore,
  type PreferenceStore,
} from "./preference-store.js";

export { InMemoryActiveTaskStore, type ActiveTaskStore } from "./task-store.js";

export {
  ContextManager,
  getDefaultContextManager,
  setDefaultContextManager,
  type ContextManagerOptions,
} from "./manager.js";

export {
  attachContextPackage,
  buildContextPackage,
  DEFAULT_CONTEXT_BUILDER_OPTIONS,
  type ContextBuilderOptions,
} from "./builder.js";

export {
  compressConversation,
  isNearDuplicate,
  tokenizeForDedup,
  DEFAULT_COMPRESS_OPTIONS,
  type CompressConversationOptions,
  type CompressConversationResult,
  type CompressConversationStats,
} from "./compress.js";

export { createConversationProvider } from "./providers/conversation.js";
export { createPreferencesProvider } from "./providers/preferences.js";
export { createActiveTasksProvider } from "./providers/active-tasks.js";
export { createSystemStateProvider } from "./providers/system-state.js";
export { createProjectProvider } from "./providers/project.js";
export {
  createMemoryProvider,
  type MemoryRetriever,
} from "./providers/memory.js";
export {
  createKnowledgeProvider,
  type KnowledgeRetriever,
} from "./providers/knowledge.js";

import { attachContextPackage, type ContextBuilderOptions } from "./builder.js";
import { getDefaultContextManager, type ContextManager } from "./manager.js";
import type { DetectedIntent } from "../intent/types.js";
import type { NormalizedRequest } from "../types.js";
import type { LoadedContext } from "./types.js";

export interface LoadContextOptions {
  manager?: ContextManager;
  /** Skip Context Builder attach (tests). */
  skipPackage?: boolean;
  builder?: ContextBuilderOptions;
}

/** Collect context before planning/execution; attach ContextPackage. */
export function loadContext(
  request: NormalizedRequest,
  intent: DetectedIntent,
  options: LoadContextOptions = {},
): LoadedContext {
  const manager = options.manager ?? getDefaultContextManager();
  const loaded = manager.load(request, intent);
  if (options.skipPackage) {
    return loaded;
  }
  return attachContextPackage(loaded, options.builder);
}
