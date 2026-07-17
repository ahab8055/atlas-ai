/**
 * Memory domain types (Architecture/04, Data Architecture Memory Model).
 */

/** Canonical memory kinds from Architecture/04. */
export type MemoryType = "working" | "episodic" | "semantic" | "procedural";

/** Long-term subset of MemoryType (matches @atlas-ai/database LongTermMemoryType). */
export type LongTermMemoryKind = "episodic" | "semantic" | "procedural";

/**
 * Lifetime scope: short-term ≈ working; long-term ≈ episodic/semantic/procedural.
 */
export type MemoryScope = "short_term" | "long_term";

export const MEMORY_TYPES: readonly MemoryType[] = [
  "working",
  "episodic",
  "semantic",
  "procedural",
] as const;

export function isLongTermType(type: MemoryType): type is LongTermMemoryKind {
  return type !== "working";
}

export function scopeForType(type: MemoryType): MemoryScope {
  return isLongTermType(type) ? "long_term" : "short_term";
}

export interface MemoryRecord {
  id: string;
  type: MemoryType;
  scope: MemoryScope;
  content: string;
  importance?: number;
  confidence?: number;
  tags?: string[];
  sessionId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMemoryInput {
  type: MemoryType;
  content: string;
  id?: string;
  importance?: number;
  confidence?: number;
  tags?: string[];
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateMemoryInput {
  content?: string;
  importance?: number;
  confidence?: number;
  tags?: string[];
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryQuery {
  type?: MemoryType;
  scope?: MemoryScope;
  sessionId?: string;
  text?: string;
  tags?: string[];
  limit?: number;
}

/**
 * Core-compatible snippet shape (MemorySnippet) without depending on @atlas-ai/core.
 */
export interface MemorySnippetView {
  id: string;
  content: string;
  kind: MemoryType | "unknown";
  score?: number;
}

export interface ClearMemoryOptions {
  sessionId?: string;
}
