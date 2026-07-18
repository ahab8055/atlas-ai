import type { UserPreferences } from "./types.js";

/**
 * Preference store — in-memory defaults, or SQLite via @atlas-ai/profile.
 */
export interface PreferenceStore {
  get(): UserPreferences;
  set(preferences: UserPreferences): void;
  patch(partial: UserPreferences): void;
}

export class InMemoryPreferenceStore implements PreferenceStore {
  private preferences: UserPreferences;

  constructor(initial: UserPreferences = { preferredEditor: "VS Code" }) {
    this.preferences = { ...initial };
  }

  get(): UserPreferences {
    return { ...this.preferences };
  }

  set(preferences: UserPreferences): void {
    this.preferences = { ...preferences };
  }

  patch(partial: UserPreferences): void {
    this.preferences = { ...this.preferences, ...partial };
  }
}
