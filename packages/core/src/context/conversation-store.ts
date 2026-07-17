import type { ConversationTurn } from "./types.js";

/**
 * Session-scoped conversation history.
 * Default is in-memory; ShortTermMemory / desktop can supply alternatives.
 */
export interface ConversationStore {
  getTurns(sessionId: string): ConversationTurn[];
  append(sessionId: string, turn: ConversationTurn): void;
  clear(sessionId: string): void;
}

export interface InMemoryConversationStoreOptions {
  /** Max turns retained per session (oldest dropped first). Default 50. */
  maxTurns?: number;
  /** Drop turns older than this many ms; 0 disables TTL. Default 30 minutes. */
  ttlMs?: number;
  /** Clock for tests / deterministic expiry. */
  now?: () => number;
}

const DEFAULT_MAX_TURNS = 50;
const DEFAULT_TTL_MS = 1_800_000;

export class InMemoryConversationStore implements ConversationStore {
  private readonly sessions = new Map<string, ConversationTurn[]>();
  private readonly maxTurns: number;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(options: InMemoryConversationStoreOptions = {}) {
    this.maxTurns = Math.max(1, options.maxTurns ?? DEFAULT_MAX_TURNS);
    this.ttlMs = Math.max(0, options.ttlMs ?? DEFAULT_TTL_MS);
    this.now = options.now ?? (() => Date.now());
  }

  getTurns(sessionId: string): ConversationTurn[] {
    this.pruneSession(sessionId);
    return [...(this.sessions.get(sessionId) ?? [])];
  }

  append(sessionId: string, turn: ConversationTurn): void {
    this.pruneSession(sessionId);
    const existing = this.sessions.get(sessionId) ?? [];
    existing.push(turn);
    while (existing.length > this.maxTurns) {
      existing.shift();
    }
    this.sessions.set(sessionId, existing);
  }

  clear(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  private pruneSession(sessionId: string): void {
    const turns = this.sessions.get(sessionId);
    if (!turns || turns.length === 0 || this.ttlMs <= 0) {
      return;
    }
    const cutoff = this.now() - this.ttlMs;
    const kept = turns.filter((t) => {
      const ts = Date.parse(t.at);
      return Number.isFinite(ts) ? ts >= cutoff : true;
    });
    if (kept.length === 0) {
      this.sessions.delete(sessionId);
    } else {
      this.sessions.set(sessionId, kept);
    }
  }
}

export function summarizeConversation(
  sessionId: string,
  turns: readonly ConversationTurn[],
): string {
  if (turns.length === 0) {
    return `Session ${sessionId}: no prior turns`;
  }
  const last = turns[turns.length - 1];
  const intent = last.intentName ? ` (${last.intentName})` : "";
  return `Session ${sessionId}: ${turns.length} turn(s); last ${last.role}${intent}: ${truncate(last.text, 80)}`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}…`;
}
