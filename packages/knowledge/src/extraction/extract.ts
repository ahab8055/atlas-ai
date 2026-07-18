/**
 * Heuristic entity extractor — deterministic, no LLM (ADR-0047).
 */
import { normalizeEntityName, entityDedupeKey } from "./normalize.js";
import {
  APPLICATION_LEXICON,
  COMPANY_AT,
  COMPANY_SUFFIX,
  FILE_PATH,
  LOCATION_IN,
  LOCATION_OFFICE,
  NOISE,
  OPEN_APP,
  PERSON_CUE,
  PROJECT_CUE,
  TECHNOLOGY_LEXICON,
  USING_TECH,
  WORKING_ON_CUE,
} from "./patterns.js";
import type {
  ExtractEntitiesOptions,
  ExtractEntitiesResult,
  ExtractedEntityCandidate,
  ExtractionThresholds,
} from "./types.js";
import { DEFAULT_EXTRACTION_THRESHOLDS } from "./types.js";
import type { EntityType } from "../types.js";

function pushCandidate(
  map: Map<string, ExtractedEntityCandidate>,
  type: EntityType,
  rawName: string,
  confidence: number,
  evidence: string,
  reason: string,
): void {
  const name = normalizeEntityName(rawName);
  if (!name || name.length < 2) {
    return;
  }
  // Skip generic stop-words mistaken for names
  if (
    /^(?:the|a|an|my|our|this|that|it|me|you|we|they|i|on|in|at|to|for|and|or)$/i.test(
      name,
    )
  ) {
    return;
  }

  const key = entityDedupeKey(type, name);
  const existing = map.get(key);
  if (existing) {
    if (confidence > existing.confidence) {
      existing.confidence = confidence;
      existing.evidence = evidence;
    }
    if (!existing.reasons.includes(reason)) {
      existing.reasons.push(reason);
    }
    return;
  }
  map.set(key, {
    type,
    name,
    confidence,
    evidence: evidence.slice(0, 120),
    reasons: [reason],
  });
}

function matchAll(
  re: RegExp,
  text: string,
): Array<{ match: string; group?: string }> {
  const out: Array<{ match: string; group?: string }> = [];
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  const copy = new RegExp(re.source, flags);
  let m: RegExpExecArray | null;
  while ((m = copy.exec(text)) !== null) {
    out.push({ match: m[0], group: m[1] });
  }
  return out;
}

function lexiconHit(
  text: string,
  lexicon: readonly string[],
): Array<{ name: string; evidence: string }> {
  const lower = text.toLowerCase();
  const hits: Array<{ name: string; evidence: string }> = [];
  for (const term of lexicon) {
    const idx = lower.indexOf(term.toLowerCase());
    if (idx === -1) {
      continue;
    }
    // Word-ish boundary check
    const before = idx === 0 ? " " : lower[idx - 1]!;
    const afterIdx = idx + term.length;
    const after = afterIdx >= lower.length ? " " : lower[afterIdx]!;
    if (/[a-z0-9]/i.test(before) || /[a-z0-9]/i.test(after)) {
      continue;
    }
    hits.push({
      name: term,
      evidence: text.slice(Math.max(0, idx - 8), idx + term.length + 8),
    });
  }
  return hits;
}

/**
 * Extract entity candidates from conversation text.
 */
export function extractEntities(
  text: string,
  options: ExtractEntitiesOptions = {},
): ExtractEntitiesResult {
  const thresholds: ExtractionThresholds = {
    ...DEFAULT_EXTRACTION_THRESHOLDS,
    ...options.thresholds,
  };
  const trimmed = text?.trim() ?? "";
  const discarded: ExtractEntitiesResult["discarded"] = [];

  if (!trimmed) {
    return {
      candidates: [],
      discarded: [{ reason: "empty text" }],
    };
  }

  if (NOISE.test(trimmed) && trimmed.length < 40) {
    return {
      candidates: [],
      discarded: [{ reason: "noise / chitchat", text: trimmed }],
    };
  }

  const map = new Map<string, ExtractedEntityCandidate>();

  for (const { match, group } of matchAll(PERSON_CUE, trimmed)) {
    if (group) {
      pushCandidate(map, "person", group, 0.78, match, "person cue");
    }
  }

  for (const { match, group } of matchAll(PROJECT_CUE, trimmed)) {
    if (group) {
      pushCandidate(map, "project", group, 0.82, match, "project cue");
    }
  }
  for (const { match, group } of matchAll(WORKING_ON_CUE, trimmed)) {
    if (group) {
      pushCandidate(map, "project", group, 0.72, match, "working-on cue");
    }
  }

  for (const { match } of matchAll(COMPANY_SUFFIX, trimmed)) {
    pushCandidate(map, "company", match, 0.85, match, "company suffix");
  }
  for (const { match, group } of matchAll(COMPANY_AT, trimmed)) {
    if (group && !/^(?:the|home|office|work)$/i.test(group)) {
      pushCandidate(map, "company", group, 0.7, match, "at/for company cue");
    }
  }

  for (const { match, group } of matchAll(LOCATION_IN, trimmed)) {
    if (group && !/^(?:the|a|an|my)$/i.test(group)) {
      pushCandidate(map, "location", group, 0.68, match, "location cue");
    }
  }
  for (const { match } of matchAll(LOCATION_OFFICE, trimmed)) {
    const label = match.toLowerCase().includes("home")
      ? "home"
      : match.toLowerCase().includes("remote")
        ? "remote"
        : "office";
    pushCandidate(map, "location", label, 0.65, match, "place cue");
  }

  for (const { match } of matchAll(FILE_PATH, trimmed)) {
    const base = match.split(/[/\\]/).pop() ?? match;
    pushCandidate(map, "file", base, 0.88, match, "file path / extension");
  }

  for (const hit of lexiconHit(trimmed, TECHNOLOGY_LEXICON)) {
    pushCandidate(
      map,
      "technology",
      hit.name,
      0.9,
      hit.evidence,
      "technology lexicon",
    );
  }
  for (const { match, group } of matchAll(USING_TECH, trimmed)) {
    if (group) {
      const known = TECHNOLOGY_LEXICON.find(
        (t) => t.toLowerCase() === group.toLowerCase(),
      );
      pushCandidate(
        map,
        "technology",
        known ?? group,
        known ? 0.85 : 0.6,
        match,
        "using/built-with cue",
      );
    }
  }

  for (const hit of lexiconHit(trimmed, APPLICATION_LEXICON)) {
    pushCandidate(
      map,
      "application",
      hit.name,
      0.88,
      hit.evidence,
      "application lexicon",
    );
  }
  for (const { match, group } of matchAll(OPEN_APP, trimmed)) {
    if (group) {
      pushCandidate(map, "application", group, 0.86, match, "open/in app cue");
    }
  }

  if (options.applicationHint?.trim()) {
    pushCandidate(
      map,
      "application",
      options.applicationHint.trim(),
      0.8,
      options.applicationHint.trim(),
      "intent application hint",
    );
  }

  const candidates = [...map.values()]
    .filter((c) => c.confidence >= thresholds.minConfidence)
    .sort((a, b) => b.confidence - a.confidence);

  for (const c of map.values()) {
    if (c.confidence < thresholds.minConfidence) {
      discarded.push({
        reason: `below minConfidence (${c.confidence.toFixed(2)})`,
        text: `${c.type}:${c.name}`,
      });
    }
  }

  return { candidates, discarded };
}
