/**
 * Persistence / expiration policy for classified memories.
 */
import type {
  ClassificationAction,
  ClassificationThresholds,
  MemoryDurability,
  SuggestedMemoryType,
} from "./types.js";
import { DEFAULT_CLASSIFICATION_THRESHOLDS } from "./types.js";

export interface ActionSignals {
  importance: number;
  confidence: number;
  durability: MemoryDurability;
  suggestedType: SuggestedMemoryType;
}

export interface ExpireSignals {
  action: ClassificationAction;
  durability: MemoryDurability;
  importance: number;
  confidence: number;
}

export interface MemoryExpirationPolicy {
  thresholds: ClassificationThresholds;
}

export function createExpirationPolicy(
  partial: Partial<ClassificationThresholds> = {},
): MemoryExpirationPolicy {
  return {
    thresholds: { ...DEFAULT_CLASSIFICATION_THRESHOLDS, ...partial },
  };
}

/** Decide store / short_term / discard from scores + durability. */
export function resolveAction(
  signals: ActionSignals,
  thresholds: ClassificationThresholds = DEFAULT_CLASSIFICATION_THRESHOLDS,
): ClassificationAction {
  if (signals.suggestedType === "none" && signals.durability === "temporary") {
    if (
      signals.importance < thresholds.minImportanceToStore ||
      signals.confidence < thresholds.minConfidenceToStore
    ) {
      return "discard";
    }
    return "short_term";
  }

  if (signals.durability === "temporary") {
    return "short_term";
  }

  if (
    signals.importance < thresholds.minImportanceToStore ||
    signals.confidence < thresholds.minConfidenceToStore ||
    signals.suggestedType === "none"
  ) {
    return "discard";
  }

  return "store_long_term";
}

export function shouldPersist(
  result: {
    action: ClassificationAction;
    importance: number;
    confidence: number;
  },
  thresholds: ClassificationThresholds = DEFAULT_CLASSIFICATION_THRESHOLDS,
): boolean {
  return (
    result.action === "store_long_term" &&
    result.importance >= thresholds.minImportanceToStore &&
    result.confidence >= thresholds.minConfidenceToStore
  );
}

/**
 * Temporary content may get an expiresAt; permanent long-term stores usually do not.
 * Borderline short_term uses temporaryTtlMs.
 */
export function resolveExpiresAt(
  signals: ExpireSignals,
  thresholds: ClassificationThresholds = DEFAULT_CLASSIFICATION_THRESHOLDS,
  now: () => number = () => Date.now(),
): string | undefined {
  if (signals.action === "discard") {
    return undefined;
  }
  if (signals.action === "short_term" || signals.durability === "temporary") {
    if (thresholds.temporaryTtlMs <= 0) {
      return undefined;
    }
    return new Date(now() + thresholds.temporaryTtlMs).toISOString();
  }
  // Low-confidence permanent: soft TTL so purge can clean later
  if (
    signals.action === "store_long_term" &&
    signals.confidence < thresholds.minConfidenceToStore + 0.15 &&
    thresholds.temporaryTtlMs > 0
  ) {
    return new Date(now() + thresholds.temporaryTtlMs * 7).toISOString();
  }
  return undefined;
}
