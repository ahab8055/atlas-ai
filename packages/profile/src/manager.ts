import type {
  PreferenceObservationRow,
  PreferenceObservationsRepository,
  PreferenceSuggestionRow,
  PreferenceSuggestionStatus,
  PreferenceSuggestionsRepository,
  UserPreferencesRepository,
} from "@atlas-ai/database";

import {
  KEY_TO_CATEGORY,
  type PreferenceSnapshot,
  type ProfilePreference,
  camelToSnake,
  rowToProfilePreference,
  snakeToCamel,
} from "./types.js";
import {
  createPreferenceStoreAdapter,
  type PreferenceStoreView,
} from "./store-adapter.js";
import {
  extractPreferences,
  observePreferences,
  promoteSuggestions,
  type ExtractedPreference,
} from "./learning/index.js";

export interface ProfileManagerOptions {
  repo: UserPreferencesRepository;
  observations?: PreferenceObservationsRepository;
  suggestions?: PreferenceSuggestionsRepository;
  userId?: string;
}

export interface SetPreferenceOptions {
  category?: string;
  source?: "manual" | "learned" | "seed";
  confidence?: number;
  enabled?: boolean;
}

export interface ListPreferencesOptions {
  category?: string;
  enabledOnly?: boolean;
}

export interface LearnFromTextOptions {
  minConfidence?: number;
  reinforce?: boolean;
  reinforceStep?: number;
  /** When true, write prefs immediately (ADR-0050 compat). */
  autoApply?: boolean;
  minOccurrences?: number;
  requireApproval?: boolean;
}

export interface LearnFromTextResult {
  candidates: ExtractedPreference[];
  stored: ProfilePreference[];
  observations?: PreferenceObservationRow[];
  suggestionsCreated?: PreferenceSuggestionRow[];
}

export interface ObserveFromTextOptions {
  minConfidence?: number;
  minOccurrences?: number;
}

export interface ObserveFromTextResult {
  candidates: ExtractedPreference[];
  observations: PreferenceObservationRow[];
  suggestionsCreated: PreferenceSuggestionRow[];
}

const DEFAULT_REINFORCE_STEP = 0.05;

/**
 * Facade for structured user preferences + preference learning (ADR-0050/0052).
 */
export class ProfileManager {
  private readonly repo: UserPreferencesRepository;
  private readonly observations?: PreferenceObservationsRepository;
  private readonly suggestions?: PreferenceSuggestionsRepository;
  private readonly userId: string;

  constructor(options: ProfileManagerOptions) {
    this.repo = options.repo;
    this.observations = options.observations;
    this.suggestions = options.suggestions;
    this.userId = options.userId ?? "local";
  }

  get(key: string): ProfilePreference | undefined {
    const snake = normalizeKey(key);
    const row = this.repo.getRow(snake, this.userId);
    return row ? rowToProfilePreference(row) : undefined;
  }

  set(
    key: string,
    value: string,
    options: SetPreferenceOptions = {},
  ): ProfilePreference {
    const snake = normalizeKey(key);
    const category =
      options.category ??
      KEY_TO_CATEGORY[snake as keyof typeof KEY_TO_CATEGORY] ??
      "general";
    const row = this.repo.set(snake, value, {
      userId: this.userId,
      category,
      source: options.source ?? "manual",
      confidence: options.confidence ?? 1,
      enabled: options.enabled,
    });
    return rowToProfilePreference(row);
  }

  list(options: ListPreferencesOptions = {}): ProfilePreference[] {
    return this.repo
      .list({
        userId: this.userId,
        category: options.category,
        enabledOnly: options.enabledOnly,
      })
      .map(rowToProfilePreference);
  }

  delete(key: string): boolean {
    return this.repo.delete(normalizeKey(key), this.userId);
  }

  setEnabled(key: string, enabled: boolean): ProfilePreference | undefined {
    const row = this.repo.setEnabled(normalizeKey(key), enabled, this.userId);
    return row ? rowToProfilePreference(row) : undefined;
  }

  /** Enabled preferences as camelCase snapshot for context. */
  getSnapshot(): PreferenceSnapshot {
    const snapshot: PreferenceSnapshot = {};
    for (const pref of this.list({ enabledOnly: true })) {
      snapshot[snakeToCamel(pref.key)] = pref.value;
    }
    return snapshot;
  }

  applySnapshot(snapshot: PreferenceSnapshot, mode: "replace" | "patch"): void {
    if (mode === "replace") {
      for (const existing of this.list()) {
        if (!(snakeToCamel(existing.key) in snapshot)) {
          this.delete(existing.key);
        }
      }
    }
    for (const [camel, value] of Object.entries(snapshot)) {
      if (value === undefined) {
        continue;
      }
      this.set(camel, String(value), { source: "manual" });
    }
  }

  asPreferenceStore(): PreferenceStoreView {
    return createPreferenceStoreAdapter(this);
  }

  /**
   * Observe text and enqueue suggestions when thresholds are met.
   * Requires observation + suggestion repositories.
   */
  observeFromText(
    text: string,
    options: ObserveFromTextOptions = {},
  ): ObserveFromTextResult {
    if (!this.observations || !this.suggestions) {
      throw new Error(
        "observeFromText requires preferenceObservations and preferenceSuggestions repositories",
      );
    }
    const minConfidence = options.minConfidence ?? 0.55;
    const minOccurrences = options.minOccurrences ?? 2;
    const observed = observePreferences(text, {
      observations: this.observations,
      userId: this.userId,
      minConfidence,
    });
    const promoted = promoteSuggestions(observed.observations, {
      preferences: this.repo,
      suggestions: this.suggestions,
      userId: this.userId,
      minOccurrences,
      minConfidence,
    });
    return {
      candidates: observed.candidates,
      observations: observed.observations,
      suggestionsCreated: promoted.created,
    };
  }

  listSuggestions(
    options: {
      status?: PreferenceSuggestionStatus;
      limit?: number;
    } = {},
  ): PreferenceSuggestionRow[] {
    if (!this.suggestions) {
      return [];
    }
    return this.suggestions.list({
      userId: this.userId,
      status: options.status ?? "pending",
      limit: options.limit,
    });
  }

  approveSuggestion(idOrKey: string): {
    suggestion: PreferenceSuggestionRow;
    preference: ProfilePreference;
  } {
    if (!this.suggestions) {
      throw new Error("approveSuggestion requires preferenceSuggestions");
    }
    const suggestion = resolveSuggestion(
      this.suggestions,
      idOrKey,
      this.userId,
    );
    if (!suggestion) {
      throw new Error(`Suggestion not found: ${idOrKey}`);
    }
    if (suggestion.status !== "pending") {
      throw new Error(`Suggestion is ${suggestion.status}, not pending`);
    }
    const preference = this.set(suggestion.key, suggestion.value, {
      category: suggestion.category,
      source: "learned",
      confidence: suggestion.confidence,
      enabled: true,
    });
    const updated = this.suggestions.setStatus(suggestion.id, "approved");
    if (!updated) {
      throw new Error(`Failed to approve suggestion ${suggestion.id}`);
    }
    return { suggestion: updated, preference };
  }

  rejectSuggestion(idOrKey: string): PreferenceSuggestionRow {
    if (!this.suggestions) {
      throw new Error("rejectSuggestion requires preferenceSuggestions");
    }
    const suggestion = resolveSuggestion(
      this.suggestions,
      idOrKey,
      this.userId,
    );
    if (!suggestion) {
      throw new Error(`Suggestion not found: ${idOrKey}`);
    }
    if (suggestion.status !== "pending") {
      throw new Error(`Suggestion is ${suggestion.status}, not pending`);
    }
    const updated = this.suggestions.setStatus(suggestion.id, "rejected");
    if (!updated) {
      throw new Error(`Failed to reject suggestion ${suggestion.id}`);
    }
    // Reset observation streak so the same value needs a fresh run.
    this.observations?.resetCount(
      suggestion.key,
      suggestion.value,
      this.userId,
    );
    return updated;
  }

  /**
   * Learn from text. Default (requireApproval): observe + suggest.
   * With autoApply / requireApproval=false: write immediately (ADR-0050).
   */
  learnFromText(
    text: string,
    options: LearnFromTextOptions = {},
  ): LearnFromTextResult {
    const minConfidence = options.minConfidence ?? 0.55;
    const autoApply =
      options.autoApply === true || options.requireApproval === false;

    if (!autoApply && this.observations && this.suggestions) {
      const observed = this.observeFromText(text, {
        minConfidence,
        minOccurrences: options.minOccurrences ?? 2,
      });
      return {
        candidates: observed.candidates,
        stored: [],
        observations: observed.observations,
        suggestionsCreated: observed.suggestionsCreated,
      };
    }

    // Immediate write path (compat / autoApply).
    const reinforce = options.reinforce !== false;
    const step = options.reinforceStep ?? DEFAULT_REINFORCE_STEP;
    const candidates = extractPreferences(text, { minConfidence });
    const stored: ProfilePreference[] = [];

    for (const candidate of candidates) {
      const existing = this.repo.getRow(candidate.key, this.userId);
      let confidence = candidate.confidence;
      if (existing && reinforce && existing.value === candidate.value) {
        confidence = Math.min(1, existing.confidence + step);
      }
      const row = this.repo.set(candidate.key, candidate.value, {
        userId: this.userId,
        category: candidate.category,
        source: "learned",
        confidence,
        enabled: existing?.enabled !== false,
      });
      stored.push(rowToProfilePreference(row));
    }

    return { candidates, stored };
  }
}

export function createProfileManager(
  repo: UserPreferencesRepository,
  userIdOrOptions:
    | string
    | {
        userId?: string;
        observations?: PreferenceObservationsRepository;
        suggestions?: PreferenceSuggestionsRepository;
      } = "local",
): ProfileManager {
  if (typeof userIdOrOptions === "string") {
    return new ProfileManager({ repo, userId: userIdOrOptions });
  }
  return new ProfileManager({
    repo,
    userId: userIdOrOptions.userId,
    observations: userIdOrOptions.observations,
    suggestions: userIdOrOptions.suggestions,
  });
}

function normalizeKey(key: string): string {
  if (key.includes("_")) {
    return key;
  }
  return camelToSnake(key);
}

function resolveSuggestion(
  suggestions: PreferenceSuggestionsRepository,
  idOrKey: string,
  userId: string,
): PreferenceSuggestionRow | undefined {
  const byId = suggestions.get(idOrKey);
  if (byId) {
    return byId;
  }
  const snake = normalizeKey(idOrKey);
  return suggestions.getPendingByKey(snake, userId);
}
