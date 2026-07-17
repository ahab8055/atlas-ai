/**
 * Merge loser into survivor: history + consolidatedFrom metadata.
 */
import type { MemoryRecord, UpdateMemoryInput } from "../types.js";
import type { MemoryConflictMeta, MemoryHistoryEntry } from "./types.js";

export function readHistory(
  metadata: Record<string, unknown> | undefined,
): MemoryHistoryEntry[] {
  const raw = metadata?.history;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(isHistoryEntry);
}

export function readConsolidatedFrom(
  metadata: Record<string, unknown> | undefined,
): string[] {
  const raw = metadata?.consolidatedFrom;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((x): x is string => typeof x === "string");
}

export function readConflict(
  metadata: Record<string, unknown> | undefined,
): MemoryConflictMeta | undefined {
  const raw = metadata?.conflict;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return undefined;
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.withId !== "string" || typeof obj.status !== "string") {
    return undefined;
  }
  if (obj.status !== "open" && obj.status !== "resolved") {
    return undefined;
  }
  return {
    withId: obj.withId,
    status: obj.status,
    detectedAt:
      typeof obj.detectedAt === "string"
        ? obj.detectedAt
        : new Date().toISOString(),
    note: typeof obj.note === "string" ? obj.note : undefined,
  };
}

/** Build update patch that merges loser into survivor, preserving history. */
export function buildMergePatch(
  survivor: MemoryRecord,
  loser: MemoryRecord,
  nowIso: string,
): UpdateMemoryInput {
  const history = [
    ...readHistory(survivor.metadata),
    ...readHistory(loser.metadata),
  ];

  if (survivor.content.trim() !== loser.content.trim()) {
    history.push({
      at: nowIso,
      content: loser.content,
      fromId: loser.id,
      reason: "merged_duplicate",
    });
    // Prefer loser content when it is newer (Architecture Update Rules)
    const loserNewer =
      Date.parse(loser.updatedAt) >= Date.parse(survivor.updatedAt);
    if (loserNewer || (loser.confidence ?? 0) > (survivor.confidence ?? 0)) {
      history.push({
        at: nowIso,
        content: survivor.content,
        fromId: survivor.id,
        reason: "superseded_content",
      });
    }
  }

  const consolidatedFrom = [
    ...new Set([
      ...readConsolidatedFrom(survivor.metadata),
      ...readConsolidatedFrom(loser.metadata),
      loser.id,
    ]),
  ];

  const loserNewer =
    Date.parse(loser.updatedAt) >= Date.parse(survivor.updatedAt);
  const useLoserContent =
    loserNewer || (loser.confidence ?? 0) > (survivor.confidence ?? 0);

  return {
    content: useLoserContent ? loser.content : survivor.content,
    importance: Math.max(survivor.importance ?? 0, loser.importance ?? 0),
    confidence: Math.max(survivor.confidence ?? 0, loser.confidence ?? 0),
    tags: mergeTags(survivor.tags, loser.tags),
    metadata: {
      ...(survivor.metadata ?? {}),
      ...(loser.metadata ?? {}),
      history,
      consolidatedFrom,
      // Clear open conflict against the deleted loser if present
      conflict: undefined,
    },
  };
}

export function buildConflictMetadata(
  existing: Record<string, unknown> | undefined,
  withId: string,
  nowIso: string,
  note: string,
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    conflict: {
      withId,
      status: "open",
      detectedAt: nowIso,
      note,
    } satisfies MemoryConflictMeta,
  };
}

export function mergeMetadata(
  existing: Record<string, unknown> | undefined,
  patch: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!patch) {
    return existing ? { ...existing } : undefined;
  }
  const next: Record<string, unknown> = { ...(existing ?? {}), ...patch };
  // Allow clearing conflict with explicit undefined in patch via omit
  if ("conflict" in patch && patch.conflict === undefined) {
    delete next.conflict;
  }
  return next;
}

function mergeTags(
  a: string[] | undefined,
  b: string[] | undefined,
): string[] | undefined {
  const set = new Set([...(a ?? []), ...(b ?? [])]);
  if (set.size === 0) {
    return undefined;
  }
  return [...set].sort();
}

function isHistoryEntry(value: unknown): value is MemoryHistoryEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const e = value as Record<string, unknown>;
  return (
    typeof e.at === "string" &&
    typeof e.content === "string" &&
    typeof e.reason === "string"
  );
}
