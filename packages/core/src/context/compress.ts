/**
 * Heuristic conversation compression (ADR-0054) — extractive, no LLM.
 */
import type { ConversationTurn } from "./types.js";

export interface CompressConversationOptions {
  enabled?: boolean;
  /** Raw turns to keep at the end (default 4). */
  keepRecentTurns?: number;
  /** Max extractive summary bullets (default 8). */
  maxSummaryLines?: number;
  /** If conversation chars exceed this, force compress (optional). */
  maxConversationChars?: number;
}

export interface CompressConversationStats {
  compressed: boolean;
  olderTurnCount: number;
  recentTurnCount: number;
  summaryLineCount: number;
}

export interface CompressConversationResult {
  summaryLines: string[];
  recentTurns: ConversationTurn[];
  stats: CompressConversationStats;
}

export const DEFAULT_COMPRESS_OPTIONS = {
  enabled: true,
  keepRecentTurns: 4,
  maxSummaryLines: 8,
} as const;

const PREFERENCE_RE =
  /\b(prefer|preference|always|never|don't|do not|concise|verbose|brief)\b/i;
const EDITOR_LANG_RE =
  /\b(cursor|vs\s*code|vscode|neovim|vim|typescript|javascript|python|rust|go)\b/i;
const DECISION_RE =
  /\b(decid(?:e|ed)|must|should|use\s+\w+|avoid|instead|constraint)\b/i;
const PROJECT_RE =
  /\b(project|repo|repository|branch|path\s*[:=]|\/[\w./-]+)\b/i;
const REMEMBER_RE = /\b(remember|don'?t forget|keep in mind|note that)\b/i;

/**
 * Compress older conversation turns into extractive fact bullets;
 * keep the most recent turns raw.
 */
export function compressConversation(
  turns: readonly ConversationTurn[],
  options: CompressConversationOptions = {},
): CompressConversationResult {
  const enabled = options.enabled !== false;
  const keepRecent = Math.max(
    1,
    options.keepRecentTurns ?? DEFAULT_COMPRESS_OPTIONS.keepRecentTurns,
  );
  const maxSummary = Math.max(
    1,
    options.maxSummaryLines ?? DEFAULT_COMPRESS_OPTIONS.maxSummaryLines,
  );

  if (!enabled || turns.length === 0) {
    return {
      summaryLines: [],
      recentTurns: [...turns],
      stats: {
        compressed: false,
        olderTurnCount: 0,
        recentTurnCount: turns.length,
        summaryLineCount: 0,
      },
    };
  }

  const estimatedChars = turns.reduce((n, t) => n + (t.text?.length ?? 0), 0);
  const overCharBudget =
    options.maxConversationChars !== undefined &&
    estimatedChars > options.maxConversationChars;
  const shouldCompress = turns.length > keepRecent + 1 || overCharBudget;

  if (!shouldCompress) {
    return {
      summaryLines: [],
      recentTurns: [...turns],
      stats: {
        compressed: false,
        olderTurnCount: 0,
        recentTurnCount: turns.length,
        summaryLineCount: 0,
      },
    };
  }

  const recentTurns = turns.slice(-keepRecent);
  const olderTurns = turns.slice(0, Math.max(0, turns.length - keepRecent));
  const summaryLines = extractFacts(olderTurns, maxSummary);

  return {
    summaryLines,
    recentTurns,
    stats: {
      compressed: true,
      olderTurnCount: olderTurns.length,
      recentTurnCount: recentTurns.length,
      summaryLineCount: summaryLines.length,
    },
  };
}

function extractFacts(
  olderTurns: readonly ConversationTurn[],
  maxSummary: number,
): string[] {
  const facts: string[] = [];
  const seen = new Set<string>();

  const push = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed || facts.length >= maxSummary) {
      return;
    }
    const key = trimmed.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    facts.push(trimmed);
  };

  for (const turn of olderTurns) {
    if (facts.length >= maxSummary) {
      break;
    }
    if (turn.role !== "user") {
      continue;
    }
    const text = turn.text?.trim() ?? "";
    if (!text) {
      continue;
    }

    const fact = classifyUserTurn(text);
    if (fact) {
      push(fact);
    }
  }

  // Fallback: short snippets from remaining older user turns
  if (facts.length < maxSummary) {
    for (const turn of olderTurns) {
      if (facts.length >= maxSummary) {
        break;
      }
      if (turn.role !== "user") {
        continue;
      }
      const text = turn.text?.trim() ?? "";
      if (!text) {
        continue;
      }
      const key = text.toLowerCase().replace(/\s+/g, " ");
      if (seen.has(key)) {
        continue;
      }
      // Skip if already captured as a classified fact
      const already = facts.some((f) =>
        key.includes(f.toLowerCase().slice(0, 40)),
      );
      if (already) {
        continue;
      }
      push(truncate(text, 80));
    }
  }

  return facts;
}

function classifyUserTurn(text: string): string | undefined {
  if (PREFERENCE_RE.test(text) || EDITOR_LANG_RE.test(text)) {
    return formatFact("Preference", text);
  }
  if (DECISION_RE.test(text)) {
    return formatFact("Decision", text);
  }
  if (PROJECT_RE.test(text)) {
    return formatFact("Project", text);
  }
  if (REMEMBER_RE.test(text)) {
    return formatFact("Note", text);
  }
  return undefined;
}

function formatFact(label: string, text: string): string {
  return `${label}: ${truncate(text, 100)}`;
}

function truncate(text: string, max: number): string {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) {
    return t;
  }
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** Tokenize for Jaccard near-duplicate checks. */
export function tokenizeForDedup(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1),
  );
}

/**
 * True if lines are exact (normalized) or near-duplicates
 * (Jaccard ≥ threshold or shorter contained in longer).
 */
export function isNearDuplicate(
  a: string,
  b: string,
  threshold = 0.85,
): boolean {
  const na = a.trim().toLowerCase().replace(/\s+/g, " ");
  const nb = b.trim().toLowerCase().replace(/\s+/g, " ");
  if (!na || !nb) {
    return false;
  }
  if (na === nb) {
    return true;
  }
  if (na.includes(nb) || nb.includes(na)) {
    const shorter = na.length <= nb.length ? na : nb;
    if (shorter.length >= 12) {
      return true;
    }
  }
  const ta = tokenizeForDedup(na);
  const tb = tokenizeForDedup(nb);
  if (ta.size === 0 || tb.size === 0) {
    return false;
  }
  let inter = 0;
  for (const t of ta) {
    if (tb.has(t)) {
      inter += 1;
    }
  }
  const union = ta.size + tb.size - inter;
  return union > 0 && inter / union >= threshold;
}
