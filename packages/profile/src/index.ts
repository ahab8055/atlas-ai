export type {
  PreferenceCategory,
  PreferenceSnapshot,
  ProfileKeyCamel,
  ProfileKeySnake,
  ProfilePreference,
} from "./types.js";

export {
  KEY_TO_CATEGORY,
  PREFERENCE_CATEGORIES,
  PROFILE_KEYS,
  camelToSnake,
  rowToProfilePreference,
  snakeToCamel,
} from "./types.js";

export {
  ProfileManager,
  createProfileManager,
  type LearnFromTextOptions,
  type LearnFromTextResult,
  type ListPreferencesOptions,
  type ProfileManagerOptions,
  type SetPreferenceOptions,
} from "./manager.js";

export {
  createPreferenceStoreAdapter,
  type PreferenceStoreBackend,
  type PreferenceStoreView,
} from "./store-adapter.js";

export {
  extractPreferences,
  type ExtractedPreference,
  type ExtractPreferencesOptions,
} from "./learning/index.js";
