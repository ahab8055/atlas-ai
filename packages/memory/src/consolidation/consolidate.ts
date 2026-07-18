/**
 * Batch and against-text consolidation orchestration.
 */
import type { LongTermMemoryType } from "@atlas-ai/database";

import type { MemoryRecord, UpdateMemoryInput } from "../types.js";
import type { RetrievedMemory } from "../retrieval/types.js";
import {
  chooseSurvivor,
  detectContradiction,
  isNearDuplicate,
  mergeThresholds,
  pairSimilarity,
} from "./detect.js";
import {
  buildConflictMetadata,
  buildMergePatch,
  mergeMetadata,
  readConflict,
} from "./merge.js";
import type {
  ConsolidateAgainstOptions,
  ConsolidateAgainstResult,
  ConsolidateOptions,
  ConsolidationDecision,
  ConsolidationPairResult,
  ConsolidationResult,
  ConsolidationThresholds,
} from "./types.js";

/** Minimal port so consolidation does not circular-import LongTermMemory. */
export interface ConsolidationStore {
  list(options: {
    type?: LongTermMemoryType;
    userId?: string;
    limit?: number;
  }): MemoryRecord[];
  retrieve(
    text: string,
    options?: {
      type?: LongTermMemoryType;
      limit?: number;
      minScore?: number;
      userId?: string;
    },
  ): RetrievedMemory[];
  get(id: string): MemoryRecord | undefined;
  update(id: string, patch: UpdateMemoryInput): MemoryRecord;
  delete(id: string): boolean;
  store(input: {
    type: LongTermMemoryType;
    content: string;
    importance?: number;
    confidence?: number;
    tags?: string[];
    sessionId?: string;
    projectId?: string;
    metadata?: Record<string, unknown>;
  }): MemoryRecord;
}

export function consolidateMemories(
  store: ConsolidationStore,
  options: ConsolidateOptions = {},
): ConsolidationResult {
  const thresholds = mergeThresholds(options.thresholds);
  const dryRun = options.dryRun === true;
  const nowIso = new Date((options.now ?? Date.now)()).toISOString();
  const scanLimit = options.limit ?? 100;

  const rows = store.list({
    type: options.type,
    userId: options.userId,
    limit: scanLimit,
  });

  const pairs: ConsolidationPairResult[] = [];
  const deleted = new Set<string>();
  const processedPairs = new Set<string>();

  let merged = 0;
  let conflicts = 0;
  let skipped = 0;

  for (const anchor of rows) {
    if (deleted.has(anchor.id)) {
      continue;
    }

    const hits = store.retrieve(anchor.content, {
      type: (anchor.type as LongTermMemoryType) || options.type,
      limit: thresholds.candidateLimit,
      minScore:
        Math.min(thresholds.conflictMinScore, thresholds.mergeMinScore) * 0.5,
      userId: options.userId,
    });

    for (const hit of hits) {
      if (hit.record.id === anchor.id || deleted.has(hit.record.id)) {
        continue;
      }
      if (hit.record.type !== anchor.type) {
        continue;
      }

      const pairKey = [anchor.id, hit.record.id].sort().join(":");
      if (processedPairs.has(pairKey)) {
        continue;
      }
      processedPairs.add(pairKey);

      const score = pairSimilarity(anchor.content, hit.record.content);
      const decision = decidePair(anchor, hit.record, score, thresholds);

      if (decision.action === "skip") {
        skipped += 1;
        pairs.push({ decision, dryRun });
        continue;
      }

      if (decision.action === "flag_conflict") {
        conflicts += 1;
        if (!dryRun) {
          applyConflict(store, decision, nowIso);
        }
        pairs.push({ decision, dryRun });
        continue;
      }

      // merge
      merged += 1;
      if (dryRun) {
        pairs.push({ decision, dryRun });
        continue;
      }

      const survivor = store.get(decision.survivorId);
      const loser = store.get(decision.otherId);
      if (!survivor || !loser) {
        skipped += 1;
        continue;
      }

      const patch = buildMergePatch(survivor, loser, nowIso);
      const updated = store.update(survivor.id, {
        ...patch,
        metadata: mergeMetadata(survivor.metadata, patch.metadata),
      });
      store.delete(loser.id);
      deleted.add(loser.id);
      pairs.push({
        decision,
        survivor: updated,
        deletedId: loser.id,
        dryRun: false,
      });
    }
  }

  return {
    scanned: rows.length,
    merged,
    conflicts,
    skipped,
    pairs,
  };
}

/**
 * Consolidate a new candidate against existing memories before insert.
 */
export function consolidateAgainstText(
  store: ConsolidationStore,
  text: string,
  options: ConsolidateAgainstOptions,
): ConsolidateAgainstResult {
  const thresholds = mergeThresholds(options.thresholds);
  const nowIso = new Date((options.now ?? Date.now)()).toISOString();
  const trimmed = text.trim();

  const hits = store.retrieve(trimmed, {
    type: options.type,
    limit: thresholds.candidateLimit,
    minScore: thresholds.conflictMinScore * 0.5,
  });

  let best: { hit: RetrievedMemory; score: number } | undefined;
  for (const hit of hits) {
    if (hit.record.type !== options.type) {
      continue;
    }
    const score = pairSimilarity(trimmed, hit.record.content);
    if (!best || score > best.score) {
      best = { hit, score };
    }
  }

  if (!best) {
    const record = store.store({
      type: options.type,
      content: trimmed,
      importance: options.importance,
      confidence: options.confidence,
      tags: options.tags,
      sessionId: options.sessionId,
      projectId: options.projectId,
      metadata: options.metadata,
    });
    return { action: "insert", record };
  }

  const candidate: MemoryRecord = {
    id: "__candidate__",
    type: options.type,
    scope: "long_term",
    content: trimmed,
    importance: options.importance,
    confidence: options.confidence,
    tags: options.tags,
    sessionId: options.sessionId,
    projectId: options.projectId,
    metadata: options.metadata,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  const decision = decidePair(
    best.hit.record,
    candidate,
    best.score,
    thresholds,
  );

  if (decision.action === "merge") {
    const existing = store.get(best.hit.record.id)!;
    const historyPatch = buildMergePatch(
      existing,
      { ...candidate, id: "incoming" },
      nowIso,
    );
    const updated = store.update(existing.id, {
      content: historyPatch.content,
      importance: Math.max(existing.importance ?? 0, options.importance ?? 0),
      confidence: Math.max(existing.confidence ?? 0, options.confidence ?? 0),
      tags: historyPatch.tags,
      metadata: mergeMetadata(existing.metadata, {
        ...historyPatch.metadata,
        ...(options.metadata ?? {}),
      }),
    });
    return {
      action: "merge",
      record: updated,
      decision: {
        ...decision,
        survivorId: existing.id,
        otherId: "incoming",
      },
    };
  }

  if (decision.action === "flag_conflict") {
    const existing = store.get(best.hit.record.id)!;
    store.update(existing.id, {
      metadata: buildConflictMetadata(
        existing.metadata,
        "incoming",
        nowIso,
        decision.reason,
      ),
    });
    const record = store.store({
      type: options.type,
      content: trimmed,
      importance: options.importance,
      confidence: options.confidence,
      tags: options.tags,
      sessionId: options.sessionId,
      projectId: options.projectId,
      metadata: buildConflictMetadata(
        options.metadata,
        existing.id,
        nowIso,
        decision.reason,
      ),
    });
    // Fix cross-ids now that incoming has a real id
    store.update(existing.id, {
      metadata: buildConflictMetadata(
        existing.metadata,
        record.id,
        nowIso,
        decision.reason,
      ),
    });
    return {
      action: "flag_conflict",
      record,
      decision: {
        ...decision,
        survivorId: existing.id,
        otherId: record.id,
      },
    };
  }

  const record = store.store({
    type: options.type,
    content: trimmed,
    importance: options.importance,
    confidence: options.confidence,
    tags: options.tags,
    sessionId: options.sessionId,
    projectId: options.projectId,
    metadata: options.metadata,
  });
  return { action: "insert", record, decision };
}

function decidePair(
  left: MemoryRecord,
  right: MemoryRecord,
  score: number,
  thresholds: ConsolidationThresholds,
): ConsolidationDecision {
  const { survivor, loser } = chooseSurvivor(left, right);

  if (isNearDuplicate(score, thresholds)) {
    if (detectContradiction(left.content, right.content)) {
      return {
        action: "flag_conflict",
        score,
        survivorId: survivor.id,
        otherId: loser.id,
        reason: "contradictory near-duplicate preferences",
      };
    }
    return {
      action: "merge",
      score,
      survivorId: survivor.id,
      otherId: loser.id,
      reason: "near-duplicate content",
    };
  }

  if (
    score >= thresholds.conflictMinScore &&
    detectContradiction(left.content, right.content)
  ) {
    return {
      action: "flag_conflict",
      score,
      survivorId: survivor.id,
      otherId: loser.id,
      reason: "conflicting preferences or facts",
    };
  }

  // Editor supersede: medium similarity + same editor slot → merge/update
  if (
    score >= thresholds.conflictMinScore &&
    !detectContradiction(left.content, right.content) &&
    /\beditor\b/i.test(left.content) &&
    /\beditor\b/i.test(right.content)
  ) {
    return {
      action: "merge",
      score,
      survivorId: survivor.id,
      otherId: loser.id,
      reason: "superseding preference update",
    };
  }

  return {
    action: "skip",
    score,
    survivorId: survivor.id,
    otherId: loser.id,
    reason: "not similar enough",
  };
}

function applyConflict(
  store: ConsolidationStore,
  decision: ConsolidationDecision,
  nowIso: string,
): void {
  const a = store.get(decision.survivorId);
  const b = store.get(decision.otherId);
  if (!a || !b) {
    return;
  }
  // Skip if already flagged against each other
  const existingA = readConflict(a.metadata);
  if (existingA?.withId === b.id && existingA.status === "open") {
    return;
  }
  store.update(a.id, {
    metadata: buildConflictMetadata(a.metadata, b.id, nowIso, decision.reason),
  });
  store.update(b.id, {
    metadata: buildConflictMetadata(b.metadata, a.id, nowIso, decision.reason),
  });
}
