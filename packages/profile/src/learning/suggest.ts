/**
 * Promote observations over threshold into pending suggestions (ADR-0052).
 */
import type {
  PreferenceObservationRow,
  PreferenceSuggestionRow,
  PreferenceSuggestionsRepository,
  UserPreferencesRepository,
} from "@atlas-ai/database";

export interface PromoteSuggestionsOptions {
  preferences: UserPreferencesRepository;
  suggestions: PreferenceSuggestionsRepository;
  userId?: string;
  minOccurrences?: number;
  minConfidence?: number;
}

export interface PromoteSuggestionsResult {
  created: PreferenceSuggestionRow[];
  skipped: Array<{ key: string; value: string; reason: string }>;
}

/**
 * For each observation at/above threshold, upsert a pending suggestion.
 * Skips when pref already matches, key is disabled, or same value was rejected
 * with a reset streak still below threshold (caller resets on reject).
 */
export function promoteSuggestions(
  observations: PreferenceObservationRow[],
  options: PromoteSuggestionsOptions,
): PromoteSuggestionsResult {
  const userId = options.userId ?? "local";
  const minOccurrences = Math.max(1, options.minOccurrences ?? 2);
  const minConfidence = options.minConfidence ?? 0.55;
  const created: PreferenceSuggestionRow[] = [];
  const skipped: Array<{ key: string; value: string; reason: string }> = [];

  for (const obs of observations) {
    if (obs.count < minOccurrences) {
      skipped.push({
        key: obs.key,
        value: obs.value,
        reason: `below_occurrences(${obs.count}<${minOccurrences})`,
      });
      continue;
    }
    if (obs.lastConfidence < minConfidence) {
      skipped.push({
        key: obs.key,
        value: obs.value,
        reason: `below_confidence(${obs.lastConfidence}<${minConfidence})`,
      });
      continue;
    }

    const existing = options.preferences.getRow(obs.key, userId);
    if (existing?.enabled === false) {
      skipped.push({
        key: obs.key,
        value: obs.value,
        reason: "key_disabled",
      });
      continue;
    }
    if (existing && existing.value === obs.value) {
      skipped.push({
        key: obs.key,
        value: obs.value,
        reason: "already_set",
      });
      continue;
    }

    const row = options.suggestions.upsertPending({
      userId,
      key: obs.key,
      value: obs.value,
      category: obs.category,
      confidence: obs.lastConfidence,
      observationCount: obs.count,
      reason: `Observed ${obs.count} time(s)`,
    });
    created.push(row);
  }

  return { created, skipped };
}
