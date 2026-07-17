/**
 * Short-term memory — bounded session conversation buffer (Architecture/04 working).
 */
import { randomUUID } from "node:crypto";

import type { MemoryManager } from "../manager.js";
import type {
  ConversationStoreAdapter,
  ShortTermMemoryConfig,
  ShortTermMemoryOptions,
  ShortTermTurn,
} from "./types.js";
import {
  DEFAULT_SHORT_TERM_MAX_ENTRIES,
  DEFAULT_SHORT_TERM_TTL_MS,
} from "./types.js";

const MIRROR_KIND = "conversation_turn";

export class ShortTermMemory {
  private readonly sessions = new Map<string, ShortTermTurn[]>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly memoryManager?: MemoryManager;

  constructor(options: ShortTermMemoryOptions = {}) {
    this.maxEntries = Math.max(
      1,
      options.maxEntries ?? DEFAULT_SHORT_TERM_MAX_ENTRIES,
    );
    this.ttlMs = Math.max(0, options.ttlMs ?? DEFAULT_SHORT_TERM_TTL_MS);
    this.now = options.now ?? (() => Date.now());
    this.memoryManager = options.memoryManager;
  }

  getConfig(): ShortTermMemoryConfig {
    return { maxEntries: this.maxEntries, ttlMs: this.ttlMs };
  }

  append(sessionId: string, turn: ShortTermTurn): void {
    const at = turn.at || new Date(this.now()).toISOString();
    const entry: ShortTermTurn = {
      role: turn.role,
      text: turn.text,
      intentName: turn.intentName,
      at,
    };
    this.pruneSession(sessionId);
    const turns = this.sessions.get(sessionId) ?? [];
    turns.push(entry);
    while (turns.length > this.maxEntries) {
      turns.shift();
    }
    this.sessions.set(sessionId, turns);
    this.scheduleRemirror(sessionId);
  }

  getTurns(sessionId: string): ShortTermTurn[] {
    this.pruneSession(sessionId);
    return [...(this.sessions.get(sessionId) ?? [])];
  }

  clear(sessionId: string): void {
    this.sessions.delete(sessionId);
    void this.mirrorClear(sessionId);
  }

  /** Drop expired turns for one session or all sessions. */
  prune(sessionId?: string): number {
    if (sessionId !== undefined) {
      const before = this.sessions.get(sessionId)?.length ?? 0;
      this.pruneSession(sessionId);
      const after = this.sessions.get(sessionId)?.length ?? 0;
      const removed = Math.max(0, before - after);
      if (removed > 0) {
        this.scheduleRemirror(sessionId);
      }
      return removed;
    }
    let removed = 0;
    for (const id of [...this.sessions.keys()]) {
      removed += this.prune(id);
    }
    return removed;
  }

  toConversationStore(): ConversationStoreAdapter {
    return {
      getTurns: (sessionId) => this.getTurns(sessionId),
      append: (sessionId, turn) => this.append(sessionId, turn),
      clear: (sessionId) => this.clear(sessionId),
    };
  }

  private pruneSession(sessionId: string): void {
    const turns = this.sessions.get(sessionId);
    if (!turns || turns.length === 0) {
      return;
    }
    if (this.ttlMs <= 0) {
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

  private scheduleRemirror(sessionId: string): void {
    if (!this.memoryManager) {
      return;
    }
    void this.remirrorSession(sessionId);
  }

  private async remirrorSession(sessionId: string): Promise<void> {
    if (!this.memoryManager) {
      return;
    }
    try {
      await this.memoryManager.clear("working", { sessionId });
      const turns = this.sessions.get(sessionId) ?? [];
      for (const turn of turns) {
        await this.memoryManager.store({
          type: "working",
          id: randomUUID(),
          content: turn.text,
          sessionId,
          metadata: {
            kind: MIRROR_KIND,
            role: turn.role,
            intentName: turn.intentName,
            at: turn.at,
          },
        });
      }
    } catch {
      /* mirror is best-effort */
    }
  }

  private async mirrorClear(sessionId: string): Promise<void> {
    if (!this.memoryManager) {
      return;
    }
    try {
      await this.memoryManager.clear("working", { sessionId });
    } catch {
      /* mirror is best-effort */
    }
  }
}

export function createShortTermMemory(
  options: ShortTermMemoryOptions = {},
): ShortTermMemory {
  return new ShortTermMemory(options);
}
