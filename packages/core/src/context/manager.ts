import {
  createShortTermMemory,
  type ShortTermMemoryOptions,
} from "@atlas-ai/memory";
import type { DetectedIntent } from "../intent/types.js";
import type { NormalizedRequest } from "../types.js";
import {
  summarizeConversation,
  type ConversationStore,
} from "./conversation-store.js";
import {
  InMemoryPreferenceStore,
  type PreferenceStore,
} from "./preference-store.js";
import { createActiveTasksProvider } from "./providers/active-tasks.js";
import { createConversationProvider } from "./providers/conversation.js";
import { createKnowledgeProvider } from "./providers/knowledge.js";
import { createMemoryProvider } from "./providers/memory.js";
import { createPreferencesProvider } from "./providers/preferences.js";
import { createProjectProvider } from "./providers/project.js";
import { createSystemStateProvider } from "./providers/system-state.js";
import { InMemoryActiveTaskStore, type ActiveTaskStore } from "./task-store.js";
import type {
  ContextContribution,
  ContextLoadInput,
  ContextProvider,
  ContextSourceId,
  ConversationTurn,
  LoadedContext,
  SystemStateInfo,
} from "./types.js";

export interface ContextManagerOptions {
  conversationStore?: ConversationStore;
  /** Options when creating default ShortTermMemory-backed store. */
  shortTermOptions?: ShortTermMemoryOptions;
  preferenceStore?: PreferenceStore;
  taskStore?: ActiveTaskStore;
  /** Extra / replacement providers (by id). */
  providers?: ContextProvider[];
}

/**
 * Assembles context from pluggable providers before planning/execution.
 */
export class ContextManager {
  readonly conversationStore: ConversationStore;
  readonly preferenceStore: PreferenceStore;
  readonly taskStore: ActiveTaskStore;
  private readonly providers = new Map<ContextSourceId, ContextProvider>();

  constructor(options: ContextManagerOptions = {}) {
    this.conversationStore =
      options.conversationStore ??
      (createShortTermMemory(
        options.shortTermOptions,
      ).toConversationStore() as ConversationStore);
    this.preferenceStore =
      options.preferenceStore ?? new InMemoryPreferenceStore();
    this.taskStore = options.taskStore ?? new InMemoryActiveTaskStore();

    const builtins: ContextProvider[] = [
      createConversationProvider(this.conversationStore),
      createPreferencesProvider(this.preferenceStore),
      createActiveTasksProvider(this.taskStore),
      createSystemStateProvider(),
      createProjectProvider(),
      createMemoryProvider(),
      createKnowledgeProvider(),
    ];

    for (const provider of builtins) {
      this.providers.set(provider.id, provider);
    }
    for (const provider of options.providers ?? []) {
      this.providers.set(provider.id, provider);
    }
  }

  registerProvider(provider: ContextProvider): void {
    this.providers.set(provider.id, provider);
  }

  load(request: NormalizedRequest, intent: DetectedIntent): LoadedContext {
    const input: ContextLoadInput = {
      request: {
        sessionId: request.sessionId,
        text: request.text,
        source: request.source,
      },
      intent,
    };
    const contributions: ContextContribution[] = [];

    for (const provider of this.providers.values()) {
      contributions.push(provider.load(input));
    }

    return mergeContributions(contributions, request.sessionId);
  }

  /** Record assistant output after response generation (conversation continuity). */
  recordAssistant(sessionId: string, text: string, intentName?: string): void {
    const turn: ConversationTurn = {
      role: "assistant",
      text,
      intentName,
      at: new Date().toISOString(),
    };
    this.conversationStore.append(sessionId, turn);
  }
}

function mergeContributions(
  contributions: readonly ContextContribution[],
  sessionId: string,
): LoadedContext {
  const sources: ContextSourceId[] = [];
  let conversationTurns: ConversationTurn[] = [];
  let conversationSummary = `Session ${sessionId}: no prior turns`;
  let preferences: LoadedContext["preferences"] = {};
  let activeTasks: LoadedContext["activeTasks"] = [];
  let systemState: SystemStateInfo | undefined;
  let memories: LoadedContext["memories"] = [];
  let knowledge: LoadedContext["knowledge"] = [];
  let project: LoadedContext["project"];

  for (const part of contributions) {
    sources.push(part.source);

    if (part.conversation) {
      conversationTurns = part.conversation.turns ?? conversationTurns;
      if (part.conversation.summary) {
        conversationSummary = part.conversation.summary;
      }
    }
    if (part.preferences) {
      preferences = { ...preferences, ...part.preferences };
    }
    if (part.activeTasks) {
      activeTasks = part.activeTasks;
    }
    if (part.systemState) {
      systemState = {
        runtime: part.systemState.runtime ?? "atlas-core",
        source: part.systemState.source ?? "cli",
        platform: part.systemState.platform ?? "unknown",
        arch: part.systemState.arch ?? "unknown",
        nodeVersion: part.systemState.nodeVersion ?? "",
        collectedAt: part.systemState.collectedAt ?? new Date().toISOString(),
      };
    }
    if (part.memories) {
      memories = part.memories;
    }
    if (part.knowledge) {
      knowledge = part.knowledge;
    }
    if (part.project) {
      project = { ...project, ...part.project };
    }
  }

  if (!systemState) {
    systemState = {
      runtime: "atlas-core",
      source: "cli",
      platform: "unknown",
      arch: "unknown",
      nodeVersion: "",
      collectedAt: new Date().toISOString(),
    };
  }

  if (conversationTurns.length > 0) {
    conversationSummary = summarizeConversation(sessionId, conversationTurns);
  }

  return {
    assembledAt: new Date().toISOString(),
    sources,
    conversation: {
      sessionId,
      turns: conversationTurns,
      summary: conversationSummary,
    },
    preferences,
    activeTasks,
    systemState,
    memories,
    knowledge,
    project,
    conversationSummary,
  };
}

let defaultManager: ContextManager | undefined;

export function getDefaultContextManager(): ContextManager {
  defaultManager ??= new ContextManager();
  return defaultManager;
}

/** Test helper — replace the process-wide default manager. */
export function setDefaultContextManager(manager: ContextManager): void {
  defaultManager = manager;
}
