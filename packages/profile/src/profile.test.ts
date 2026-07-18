import { describe, expect, it } from "vitest";

import { openAtlasDatabase } from "@atlas-ai/database";

import {
  createProfileManager,
  extractPreferences,
  PROFILE_KEYS,
} from "./index.js";

describe("extractPreferences", () => {
  it("extracts editor and communication prefs from text", () => {
    const hits = extractPreferences(
      "I prefer Cursor and please be concise in answers",
    );
    expect(hits.some((h) => h.key === PROFILE_KEYS.preferredEditor)).toBe(true);
    expect(hits.some((h) => h.key === PROFILE_KEYS.communicationStyle)).toBe(
      true,
    );
  });

  it("extracts coding language", () => {
    const hits = extractPreferences("I always use TypeScript for projects");
    expect(hits.some((h) => h.value === "TypeScript")).toBe(true);
  });
});

describe("ProfileManager", () => {
  it("persists prefs and exposes PreferenceStore adapter", () => {
    const db = openAtlasDatabase({ path: ":memory:" });
    try {
      const profile = createProfileManager(db.userPreferences);
      profile.set("preferredEditor", "Cursor", { category: "tools" });
      expect(profile.get("preferred_editor")?.value).toBe("Cursor");

      const store = profile.asPreferenceStore();
      const snap = store.get();
      expect(snap.preferredEditor).toBe("Cursor");

      store.patch({ communicationStyle: "concise" });
      expect(profile.get("communication_style")?.value).toBe("concise");

      profile.setEnabled("theme", false);
      expect(profile.getSnapshot().theme).toBeUndefined();
    } finally {
      db.close();
    }
  });

  it("learns from text into structured preferences", () => {
    const db = openAtlasDatabase({ path: ":memory:", skipSeed: true });
    try {
      const profile = createProfileManager(db.userPreferences);
      const result = profile.learnFromText(
        "I prefer Cursor and be concise please",
        { minConfidence: 0.55, autoApply: true },
      );
      expect(result.stored.length).toBeGreaterThanOrEqual(1);
      expect(profile.get("preferred_editor")?.source).toBe("learned");
      expect(profile.get("preferred_editor")?.value).toBe("Cursor");
    } finally {
      db.close();
    }
  });

  it("observes repeats then suggests; approve persists preference", () => {
    const db = openAtlasDatabase({ path: ":memory:", skipSeed: true });
    try {
      const profile = createProfileManager(db.userPreferences, {
        observations: db.preferenceObservations,
        suggestions: db.preferenceSuggestions,
      });

      const first = profile.observeFromText("I prefer Cursor for editing", {
        minOccurrences: 2,
      });
      expect(first.suggestionsCreated).toHaveLength(0);
      expect(first.observations.some((o) => o.count === 1)).toBe(true);

      const second = profile.observeFromText("I prefer Cursor for editing", {
        minOccurrences: 2,
      });
      expect(second.suggestionsCreated.length).toBeGreaterThanOrEqual(1);
      expect(profile.get("preferred_editor")).toBeUndefined();

      const pending = profile.listSuggestions({ status: "pending" });
      expect(pending.length).toBeGreaterThanOrEqual(1);
      const approved = profile.approveSuggestion(pending[0]!.id);
      expect(approved.preference.value).toBe("Cursor");
      expect(profile.get("preferred_editor")?.source).toBe("learned");
    } finally {
      db.close();
    }
  });

  it("reject clears pending and resets observation streak", () => {
    const db = openAtlasDatabase({ path: ":memory:", skipSeed: true });
    try {
      const profile = createProfileManager(db.userPreferences, {
        observations: db.preferenceObservations,
        suggestions: db.preferenceSuggestions,
      });
      profile.observeFromText("I prefer Cursor", { minOccurrences: 2 });
      const second = profile.observeFromText("I prefer Cursor", {
        minOccurrences: 2,
      });
      expect(second.suggestionsCreated.length).toBeGreaterThanOrEqual(1);
      for (const sug of second.suggestionsCreated) {
        profile.rejectSuggestion(sug.id);
      }
      expect(profile.listSuggestions({ status: "pending" })).toHaveLength(0);
      expect(profile.get("preferred_editor")).toBeUndefined();

      const again = profile.observeFromText("I prefer Cursor", {
        minOccurrences: 2,
      });
      expect(again.suggestionsCreated).toHaveLength(0);
    } finally {
      db.close();
    }
  });
});
