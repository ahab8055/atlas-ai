import type { UserPreferencesRepository } from "@atlas-ai/database";

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
  type ExtractedPreference,
} from "./learning/extract.js";

export interface ProfileManagerOptions {
  repo: UserPreferencesRepository;
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
}

export interface LearnFromTextResult {
  candidates: ExtractedPreference[];
  stored: ProfilePreference[];
}

const DEFAULT_REINFORCE_STEP = 0.05;

/**
 * Facade for structured user preferences + heuristic learning (ADR-0050).
 */
export class ProfileManager {
  private readonly repo: UserPreferencesRepository;
  private readonly userId: string;

  constructor(options: ProfileManagerOptions) {
    this.repo = options.repo;
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

  learnFromText(
    text: string,
    options: LearnFromTextOptions = {},
  ): LearnFromTextResult {
    const minConfidence = options.minConfidence ?? 0.55;
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
  userId = "local",
): ProfileManager {
  return new ProfileManager({ repo, userId });
}

function normalizeKey(key: string): string {
  if (key.includes("_")) {
    return key;
  }
  return camelToSnake(key);
}
