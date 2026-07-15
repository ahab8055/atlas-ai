import type { PreferenceStore } from "../preference-store.js";
import type { ContextContribution, ContextProvider } from "../types.js";

export function createPreferencesProvider(
  store: PreferenceStore,
): ContextProvider {
  return {
    id: "preferences",
    load() {
      return {
        source: "preferences",
        preferences: store.get(),
      } satisfies ContextContribution;
    },
  };
}
