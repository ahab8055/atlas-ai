/**
 * Observe preference candidates from text and increment counts (ADR-0052).
 */
import type {
  PreferenceObservationRow,
  PreferenceObservationsRepository,
} from "@atlas-ai/database";

import {
  extractPreferences,
  type ExtractedPreference,
  type ExtractPreferencesOptions,
} from "./extract.js";

export interface ObservePreferencesOptions extends ExtractPreferencesOptions {
  observations: PreferenceObservationsRepository;
  userId?: string;
}

export interface ObservePreferencesResult {
  candidates: ExtractedPreference[];
  observations: PreferenceObservationRow[];
}

/**
 * Extract preference candidates and increment observation counts.
 */
export function observePreferences(
  text: string,
  options: ObservePreferencesOptions,
): ObservePreferencesResult {
  const userId = options.userId ?? "local";
  const candidates = extractPreferences(text, {
    minConfidence: options.minConfidence,
  });
  const observations: PreferenceObservationRow[] = [];

  for (const candidate of candidates) {
    const row = options.observations.increment({
      userId,
      key: candidate.key,
      value: candidate.value,
      category: candidate.category,
      confidence: candidate.confidence,
    });
    observations.push(row);
  }

  return { candidates, observations };
}
