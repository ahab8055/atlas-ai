import type { ConversationTurn } from "./types.js";

/**
 * Session-scoped conversation history.
 * Default is in-memory; desktop/memory packages can supply a durable store later.
 */
export interface ConversationStore {
  getTurns(sessionId: string): ConversationTurn[];
  append(sessionId: string, turn: ConversationTurn): void;
  clear(sessionId: string): void;
}

const MAX_TURNS_PER_SESSION = 50;

export class InMemoryConversationStore implements ConversationStore {
  private readonly sessions = new Map<string, ConversationTurn[]>();

  getTurns(sessionId: string): ConversationTurn[] {
    return [...(this.sessions.get(sessionId) ?? [])];
  }

  append(sessionId: string, turn: ConversationTurn): void {
    const existing = this.sessions.get(sessionId) ?? [];
    existing.push(turn);
    while (existing.length > MAX_TURNS_PER_SESSION) {
      existing.shift();
    }
    this.sessions.set(sessionId, existing);
  }

  clear(sessionId: string): void {
    this.sessions.delete(sessionId);
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
