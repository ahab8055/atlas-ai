import type { PreferenceCategory } from "../types.js";
import { KEY_TO_CATEGORY, PROFILE_KEYS } from "../types.js";

export interface ExtractedPreference {
  key: string;
  value: string;
  category: PreferenceCategory;
  confidence: number;
  reason: string;
}

export interface ExtractPreferencesOptions {
  minConfidence?: number;
}

/**
 * Heuristic preference extraction from conversation text (no LLM).
 */
export function extractPreferences(
  text: string,
  options: ExtractPreferencesOptions = {},
): ExtractedPreference[] {
  const minConfidence = options.minConfidence ?? 0.55;
  const raw = text?.trim() ?? "";
  if (!raw || raw.length < 6) {
    return [];
  }

  const hits: ExtractedPreference[] = [];
  const lower = raw.toLowerCase();

  const editor = matchEditor(lower);
  if (editor) {
    hits.push({
      key: PROFILE_KEYS.preferredEditor,
      value: editor.value,
      category: KEY_TO_CATEGORY.preferred_editor,
      confidence: editor.confidence,
      reason: editor.reason,
    });
  }

  const codingLang = matchCodingLanguage(lower);
  if (codingLang) {
    hits.push({
      key: PROFILE_KEYS.codingLanguage,
      value: codingLang.value,
      category: KEY_TO_CATEGORY.coding_language,
      confidence: codingLang.confidence,
      reason: codingLang.reason,
    });
  }

  const codingStyle = matchCodingStyle(lower);
  if (codingStyle) {
    hits.push({
      key: PROFILE_KEYS.codingStyle,
      value: codingStyle.value,
      category: KEY_TO_CATEGORY.coding_style,
      confidence: codingStyle.confidence,
      reason: codingStyle.reason,
    });
  }

  const language = matchSpokenLanguage(lower);
  if (language) {
    hits.push({
      key: PROFILE_KEYS.preferredLanguage,
      value: language.value,
      category: KEY_TO_CATEGORY.preferred_language,
      confidence: language.confidence,
      reason: language.reason,
    });
  }

  const communication = matchCommunication(lower);
  for (const hit of communication) {
    hits.push(hit);
  }

  const ai = matchAiPrefs(lower);
  for (const hit of ai) {
    hits.push(hit);
  }

  const productivity = matchProductivity(lower);
  if (productivity) {
    hits.push(productivity);
  }

  return hits.filter((h) => h.confidence >= minConfidence);
}

function matchEditor(
  lower: string,
): { value: string; confidence: number; reason: string } | undefined {
  if (!/\b(prefer|use|using|switch to|always use)\b/.test(lower)) {
    if (
      !/\b(cursor|vs\s*code|vscode|neovim|vim|sublime|jetbrains)\b/.test(lower)
    ) {
      return undefined;
    }
    // Weak mention without prefer verb
    if (!/\beditor\b/.test(lower)) {
      return undefined;
    }
  }
  if (/\bcursor\b/.test(lower)) {
    return {
      value: "Cursor",
      confidence: 0.85,
      reason: "editor preference: Cursor",
    };
  }
  if (/\b(vs\s*code|vscode)\b/.test(lower)) {
    return {
      value: "VS Code",
      confidence: 0.85,
      reason: "editor preference: VS Code",
    };
  }
  if (/\bneovim\b/.test(lower)) {
    return {
      value: "Neovim",
      confidence: 0.8,
      reason: "editor preference: Neovim",
    };
  }
  if (/\bvim\b/.test(lower)) {
    return { value: "Vim", confidence: 0.75, reason: "editor preference: Vim" };
  }
  return undefined;
}

function matchCodingLanguage(
  lower: string,
): { value: string; confidence: number; reason: string } | undefined {
  const prefer =
    /\b(prefer|always use|usually use|write in|code in)\b/.test(lower) ||
    /\b(typescript|javascript|python|rust|go)\b/.test(lower);
  if (!prefer) {
    return undefined;
  }
  if (/\btypescript\b/.test(lower)) {
    return {
      value: "TypeScript",
      confidence: 0.8,
      reason: "coding language: TypeScript",
    };
  }
  if (/\bjavascript\b/.test(lower)) {
    return {
      value: "JavaScript",
      confidence: 0.75,
      reason: "coding language: JavaScript",
    };
  }
  if (/\bpython\b/.test(lower)) {
    return {
      value: "Python",
      confidence: 0.75,
      reason: "coding language: Python",
    };
  }
  if (/\brust\b/.test(lower)) {
    return { value: "Rust", confidence: 0.75, reason: "coding language: Rust" };
  }
  return undefined;
}

function matchCodingStyle(
  lower: string,
): { value: string; confidence: number; reason: string } | undefined {
  if (
    /\b(functional|fp-first)\b/.test(lower) &&
    /\b(style|prefer)\b/.test(lower)
  ) {
    return {
      value: "functional",
      confidence: 0.7,
      reason: "coding style: functional",
    };
  }
  if (/\b(clean code|clean-code)\b/.test(lower)) {
    return { value: "clean", confidence: 0.7, reason: "coding style: clean" };
  }
  if (/\b(strict\s+types?|typed\s+strictly)\b/.test(lower)) {
    return {
      value: "strict-types",
      confidence: 0.75,
      reason: "coding style: strict-types",
    };
  }
  return undefined;
}

function matchSpokenLanguage(
  lower: string,
): { value: string; confidence: number; reason: string } | undefined {
  const m = lower.match(
    /\b(?:speak|reply|respond|answer)\s+(?:in\s+)?(english|spanish|french|german|urdu|hindi|chinese|japanese)\b/,
  );
  if (m?.[1]) {
    const value = m[1].charAt(0).toUpperCase() + m[1].slice(1);
    return { value, confidence: 0.85, reason: `preferred language: ${value}` };
  }
  const pref = lower.match(
    /\bprefer\s+(english|spanish|french|german|urdu|hindi)\b/,
  );
  if (pref?.[1]) {
    const value = pref[1].charAt(0).toUpperCase() + pref[1].slice(1);
    return { value, confidence: 0.8, reason: `preferred language: ${value}` };
  }
  return undefined;
}

function matchCommunication(lower: string): ExtractedPreference[] {
  const hits: ExtractedPreference[] = [];
  if (/\b(be\s+)?concise\b|\bshort\s+answers?\b|\bbrief\b/.test(lower)) {
    hits.push({
      key: PROFILE_KEYS.communicationStyle,
      value: "concise",
      category: KEY_TO_CATEGORY.communication_style,
      confidence: 0.8,
      reason: "communication: concise",
    });
    hits.push({
      key: PROFILE_KEYS.responseLength,
      value: "concise",
      category: KEY_TO_CATEGORY.response_length,
      confidence: 0.8,
      reason: "response length: concise",
    });
  }
  if (/\b(be\s+)?detailed\b|\bthorough\b|\bverbose\b/.test(lower)) {
    hits.push({
      key: PROFILE_KEYS.communicationStyle,
      value: "detailed",
      category: KEY_TO_CATEGORY.communication_style,
      confidence: 0.75,
      reason: "communication: detailed",
    });
    hits.push({
      key: PROFILE_KEYS.responseLength,
      value: "detailed",
      category: KEY_TO_CATEGORY.response_length,
      confidence: 0.75,
      reason: "response length: detailed",
    });
  }
  if (
    /\bfriendly\b/.test(lower) &&
    /\b(tone|style|communicate)\b/.test(lower)
  ) {
    hits.push({
      key: PROFILE_KEYS.communicationStyle,
      value: "friendly",
      category: KEY_TO_CATEGORY.communication_style,
      confidence: 0.7,
      reason: "communication: friendly",
    });
  }
  return hits;
}

function matchAiPrefs(lower: string): ExtractedPreference[] {
  const hits: ExtractedPreference[] = [];
  if (/\b(less\s+verbose|shorter\s+explanations)\b/.test(lower)) {
    hits.push({
      key: PROFILE_KEYS.aiVerbosity,
      value: "low",
      category: KEY_TO_CATEGORY.ai_verbosity,
      confidence: 0.75,
      reason: "ai verbosity: low",
    });
  }
  if (/\b(explain\s+(in\s+)?detail|deeper\s+explanations)\b/.test(lower)) {
    hits.push({
      key: PROFILE_KEYS.aiExplanationDepth,
      value: "deep",
      category: KEY_TO_CATEGORY.ai_explanation_depth,
      confidence: 0.75,
      reason: "ai depth: deep",
    });
  }
  return hits;
}

function matchProductivity(lower: string): ExtractedPreference | undefined {
  if (/\bfocus\s*blocks?\b|\bdeep\s+work\b/.test(lower)) {
    return {
      key: PROFILE_KEYS.productivityHabits,
      value: "focus-blocks",
      category: KEY_TO_CATEGORY.productivity_habits,
      confidence: 0.7,
      reason: "productivity: focus-blocks",
    };
  }
  if (/\bpomodoro\b/.test(lower)) {
    return {
      key: PROFILE_KEYS.productivityHabits,
      value: "pomodoro",
      category: KEY_TO_CATEGORY.productivity_habits,
      confidence: 0.75,
      reason: "productivity: pomodoro",
    };
  }
  return undefined;
}
