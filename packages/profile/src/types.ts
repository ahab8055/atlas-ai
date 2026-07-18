import type { PreferenceSource, UserPreferenceRow } from "@atlas-ai/database";

/** Preference categories for personalization (ADR-0050). */
export type PreferenceCategory =
  | "language"
  | "coding"
  | "tools"
  | "ai"
  | "productivity"
  | "communication"
  | "appearance"
  | "general";

export const PREFERENCE_CATEGORIES: readonly PreferenceCategory[] = [
  "language",
  "coding",
  "tools",
  "ai",
  "productivity",
  "communication",
  "appearance",
  "general",
] as const;

/** Known preference keys (snake_case in DB). */
export const PROFILE_KEYS = {
  preferredLanguage: "preferred_language",
  codingStyle: "coding_style",
  codingLanguage: "coding_language",
  preferredEditor: "preferred_editor",
  preferredTerminal: "preferred_terminal",
  theme: "theme",
  aiVerbosity: "ai_verbosity",
  aiExplanationDepth: "ai_explanation_depth",
  productivityHabits: "productivity_habits",
  communicationStyle: "communication_style",
  responseLength: "response_length",
} as const;

export type ProfileKeyCamel = keyof typeof PROFILE_KEYS;
export type ProfileKeySnake = (typeof PROFILE_KEYS)[ProfileKeyCamel];

export const KEY_TO_CATEGORY: Record<ProfileKeySnake, PreferenceCategory> = {
  preferred_language: "language",
  coding_style: "coding",
  coding_language: "coding",
  preferred_editor: "tools",
  preferred_terminal: "tools",
  theme: "appearance",
  ai_verbosity: "ai",
  ai_explanation_depth: "ai",
  productivity_habits: "productivity",
  communication_style: "communication",
  response_length: "communication",
};

/** Flat camelCase snapshot for context providers. */
export type PreferenceSnapshot = {
  preferredEditor?: string;
  preferredLanguage?: string;
  codingStyle?: string;
  codingLanguage?: string;
  preferredTerminal?: string;
  theme?: string;
  aiVerbosity?: string;
  aiExplanationDepth?: string;
  productivityHabits?: string;
  communicationStyle?: string;
  responseLength?: string;
  [key: string]: string | number | boolean | undefined;
};

export interface ProfilePreference {
  key: string;
  value: string;
  category: string;
  source: PreferenceSource;
  confidence: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export function rowToProfilePreference(
  row: UserPreferenceRow,
): ProfilePreference {
  return {
    key: row.key,
    value: row.value,
    category: row.category,
    source: row.source,
    confidence: row.confidence,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}
