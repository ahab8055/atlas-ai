/**
 * Memory classification types (Architecture/04 Importance Scoring).
 */
import type { LongTermMemoryKind } from "../types.js";

export type MemoryDurability = "temporary" | "permanent";

export type ClassificationAction = "discard" | "short_term" | "store_long_term";

export type SuggestedMemoryType = LongTermMemoryKind | "none";

export interface MemoryClassificationInput {
  /** Candidate text to evaluate. */
  text: string;
  /** Optional: user explicitly asked to remember (boosts scores). */
  explicitRemember?: boolean;
  /** Optional: how often this signal has been seen (0–1). */
  frequency?: number;
}

export interface ClassificationThresholds {
  minImportanceToStore: number;
  minConfidenceToStore: number;
  temporaryTtlMs: number;
}

export const DEFAULT_CLASSIFICATION_THRESHOLDS: ClassificationThresholds = {
  minImportanceToStore: 0.45,
  minConfidenceToStore: 0.35,
  temporaryTtlMs: 86_400_000, // 24h
};

export interface MemoryClassificationResult {
  action: ClassificationAction;
  durability: MemoryDurability;
  suggestedType: SuggestedMemoryType;
  importance: number;
  confidence: number;
  reasons: string[];
  /** ISO timestamp when temporary content should expire (if applicable). */
  expiresAt?: string;
}
