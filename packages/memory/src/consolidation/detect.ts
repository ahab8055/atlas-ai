/**
 * Near-duplicate and contradiction heuristics (no LLM).
 */
import {
  buildQueryVector,
  lexicalScore,
  semanticScore,
  tokenizeQuery,
} from "../retrieval/score.js";
import type { MemoryRecord } from "../types.js";
import type { ConsolidationThresholds } from "./types.js";
import { DEFAULT_CONSOLIDATION_THRESHOLDS } from "./types.js";

const TOPIC_STEMS =
  /\b(prefer|preference|like|likes|love|use|uses|using|editor|theme|mode|always|usually)\b/i;
const NEGATION = /\b(not|no longer|instead of|rather than|don't|dont|never)\b/i;
const EDITOR_SLOT = /\b(editor|vscode|vs\s*code|cursor|ide)\b/i;
const THEME_SLOT = /\b(theme|dark|light|mode)\b/i;

export function mergeThresholds(
  partial?: Partial<ConsolidationThresholds>,
): ConsolidationThresholds {
  return { ...DEFAULT_CONSOLIDATION_THRESHOLDS, ...partial };
}

/** Pairwise similarity in [0,1] using retrieval lexical + semantic mix. */
export function pairSimilarity(a: string, b: string): number {
  const tokensA = tokenizeQuery(a);
  const tokensB = tokenizeQuery(b);
  const vecA = buildQueryVector(a);
  const fakeRow = {
    content: b,
    tags: [] as string[],
    importance: 0.5,
    confidence: 0,
    updatedAt: new Date().toISOString(),
    id: "",
    userId: "local",
    type: "semantic" as const,
    source: undefined,
    sessionId: undefined,
    metadata: {},
    createdAt: new Date().toISOString(),
  };
  const lex =
    (lexicalScore(fakeRow, tokensA) +
      lexicalScore(
        {
          ...fakeRow,
          content: a,
        },
        tokensB,
      )) /
    2;
  const sem = semanticScore(b, vecA);
  return Math.max(0, Math.min(1, 0.45 * lex + 0.55 * sem));
}

export function isNearDuplicate(
  score: number,
  thresholds: ConsolidationThresholds = DEFAULT_CONSOLIDATION_THRESHOLDS,
): boolean {
  return score >= thresholds.mergeMinScore;
}

/**
 * Detect conflicting preferences/facts: shared topic stem but different objects,
 * or negation of the same topic.
 * Editor preference changes (VS Code → Cursor) are supersedes, not conflicts.
 */
export function detectContradiction(a: string, b: string): boolean {
  const textA = a.trim().toLowerCase();
  const textB = b.trim().toLowerCase();
  if (!textA || !textB) {
    return false;
  }

  // Same preference slot (editor) with different values → supersede via merge
  if (EDITOR_SLOT.test(textA) && EDITOR_SLOT.test(textB)) {
    return false;
  }

  // Opposing theme values → conflict
  if (isOpposingTheme(textA, textB)) {
    return true;
  }

  const hasTopic = TOPIC_STEMS.test(textA) && TOPIC_STEMS.test(textB);
  const negated =
    (NEGATION.test(textA) || NEGATION.test(textB)) &&
    shareSignificantTokens(textA, textB);

  if (negated) {
    return true;
  }

  if (!hasTopic) {
    return false;
  }

  const objectsA = preferenceObjects(textA);
  const objectsB = preferenceObjects(textB);
  if (objectsA.length === 0 || objectsB.length === 0) {
    return false;
  }

  const sharedObj = objectsA.some((o) => objectsB.includes(o));
  return !sharedObj;
}

function isOpposingTheme(a: string, b: string): boolean {
  if (!THEME_SLOT.test(a) || !THEME_SLOT.test(b)) {
    return false;
  }
  const aDark = /\bdark\b/.test(a);
  const aLight = /\blight\b/.test(a);
  const bDark = /\bdark\b/.test(b);
  const bLight = /\blight\b/.test(b);
  return (aDark && bLight) || (aLight && bDark);
}

export function chooseSurvivor(
  left: MemoryRecord,
  right: MemoryRecord,
): { survivor: MemoryRecord; loser: MemoryRecord } {
  const leftScore =
    (left.importance ?? 0.5) * 1000 +
    (left.confidence ?? 0) * 100 +
    Date.parse(left.updatedAt || left.createdAt);
  const rightScore =
    (right.importance ?? 0.5) * 1000 +
    (right.confidence ?? 0) * 100 +
    Date.parse(right.updatedAt || right.createdAt);

  if (rightScore > leftScore) {
    return { survivor: right, loser: left };
  }
  return { survivor: left, loser: right };
}

function shareSignificantTokens(a: string, b: string): boolean {
  const ta = new Set(tokenizeQuery(a));
  const tb = tokenizeQuery(b);
  let hits = 0;
  for (const t of tb) {
    if (ta.has(t) && t.length > 2) {
      hits += 1;
    }
  }
  return hits >= 1;
}

/** Extract likely preference/object tokens after topic verbs. */
function preferenceObjects(text: string): string[] {
  const tokens = tokenizeQuery(text).filter(
    (t) =>
      ![
        "prefer",
        "preference",
        "like",
        "likes",
        "love",
        "use",
        "uses",
        "using",
        "always",
        "usually",
        "user",
        "preferred",
        "editor",
        "theme",
        "mode",
        "interfaces",
        "interface",
      ].includes(t),
  );
  return tokens;
}
