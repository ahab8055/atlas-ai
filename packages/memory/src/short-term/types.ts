/**
 * Short-term (working) conversation buffer types.
 */
import type { MemoryManager } from "../manager.js";

export type ShortTermRole = "user" | "assistant" | "system";

export interface ShortTermTurn {
  role: ShortTermRole;
  text: string;
  intentName?: string;
  at: string;
}

export interface ShortTermMemoryConfig {
  /** Max turns retained per session (oldest dropped first). */
  maxEntries: number;
  /** Drop turns older than this many ms; 0 disables TTL. */
  ttlMs: number;
}

export const DEFAULT_SHORT_TERM_MAX_ENTRIES = 50;
export const DEFAULT_SHORT_TERM_TTL_MS = 1_800_000; // 30 minutes

export interface ShortTermMemoryOptions extends Partial<ShortTermMemoryConfig> {
  /** Clock for tests / deterministic expiry. */
  now?: () => number;
  /** When set, turns are mirrored into working MemoryRecords. */
  memoryManager?: MemoryManager;
}

/** Duck-typed ConversationStore (core) without depending on @atlas-ai/core. */
export interface ConversationStoreAdapter {
  getTurns(sessionId: string): ShortTermTurn[];
  append(sessionId: string, turn: ShortTermTurn): void;
  clear(sessionId: string): void;
}
