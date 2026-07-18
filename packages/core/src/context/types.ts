import type { DetectedIntent } from "../intent/types.js";
import type { InputSource } from "../sources.js";

/**
 * Documented context sources (Architecture/22 + story).
 * Memory and knowledge are stubbed for future package integration.
 */
export type ContextSourceId =
  | "conversation"
  | "preferences"
  | "active_tasks"
  | "system"
  | "memory"
  | "knowledge"
  | "project";

export type ConversationRole = "user" | "assistant" | "system";

export interface ConversationTurn {
  role: ConversationRole;
  text: string;
  intentName?: string;
  at: string;
}

export interface ConversationContext {
  sessionId: string;
  turns: ConversationTurn[];
  summary: string;
}

/** User preferences (later backed by memory / settings). */
export interface UserPreferences {
  preferredEditor?: string;
  timezone?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface ActiveTask {
  id: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
}

export interface SystemStateInfo {
  runtime: string;
  source: InputSource;
  platform: string;
  arch: string;
  nodeVersion: string;
  collectedAt: string;
}

/**
 * Memory hit shape — `@atlas-ai/memory` can fill these later.
 * Aligned with Memory Architecture memory types.
 */
export interface MemorySnippet {
  id: string;
  content: string;
  kind: "working" | "episodic" | "semantic" | "procedural" | "unknown";
  score?: number;
}

/** Knowledge graph snippet. */
export interface KnowledgeSnippet {
  id: string;
  label: string;
  content: string;
  /** Hybrid retrieval score when present (ADR-0049). */
  score?: number;
}

export interface ProjectContext {
  name?: string;
  path?: string;
}

/**
 * Canonical context structure collected before planning/execution.
 */
export interface LoadedContext {
  assembledAt: string;
  /** Providers that contributed data. */
  sources: ContextSourceId[];
  conversation: ConversationContext;
  preferences: UserPreferences;
  activeTasks: ActiveTask[];
  systemState: SystemStateInfo;
  memories: MemorySnippet[];
  knowledge: KnowledgeSnippet[];
  project?: ProjectContext;
  /** Compact summary for logs and simple planners. */
  conversationSummary: string;
}

export interface ContextLoadInput {
  request: {
    sessionId: string;
    text: string;
    source: InputSource;
  };
  intent: DetectedIntent;
}

/**
 * Contribution returned by a single provider.
 * Managers merge contributions into `LoadedContext`.
 */
export interface ContextContribution {
  source: ContextSourceId;
  conversation?: Partial<ConversationContext>;
  preferences?: UserPreferences;
  activeTasks?: ActiveTask[];
  systemState?: Partial<SystemStateInfo>;
  memories?: MemorySnippet[];
  knowledge?: KnowledgeSnippet[];
  project?: ProjectContext;
}

/**
 * Pluggable context source — memory / KG packages implement this later.
 */
export interface ContextProvider {
  id: ContextSourceId;
  load(input: ContextLoadInput): ContextContribution;
}
