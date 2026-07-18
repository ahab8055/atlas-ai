/**
 * Duck-typed PreferenceStore compatible with @atlas-ai/core PreferenceStore
 * without importing core.
 */
import type { PreferenceSnapshot } from "./types.js";

export interface PreferenceStoreView {
  get(): PreferenceSnapshot;
  set(preferences: PreferenceSnapshot): void;
  patch(partial: PreferenceSnapshot): void;
}

export interface PreferenceStoreBackend {
  getSnapshot(): PreferenceSnapshot;
  applySnapshot(snapshot: PreferenceSnapshot, mode: "replace" | "patch"): void;
}

export function createPreferenceStoreAdapter(
  backend: PreferenceStoreBackend,
): PreferenceStoreView {
  return {
    get() {
      return backend.getSnapshot();
    },
    set(preferences) {
      backend.applySnapshot(preferences, "replace");
    },
    patch(partial) {
      backend.applySnapshot(partial, "patch");
    },
  };
}
