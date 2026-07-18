/**
 * Build and validate memory backup snapshots (ADR-0057).
 */
import { createHash } from "node:crypto";

import type { MemoryRecord } from "../types.js";
import { isLongTermType } from "../types.js";
import {
  MEMORY_BACKUP_FORMAT,
  MEMORY_BACKUP_VERSION,
  type BackupValidationResult,
  type MemoryBackupRecord,
  type MemoryBackupSnapshot,
} from "./types.js";

/** Stable JSON for checksum — sorted keys, no whitespace variance. */
export function canonicalMemoriesJson(memories: MemoryBackupRecord[]): string {
  const normalized = memories.map((m) => ({
    id: m.id,
    type: m.type,
    content: m.content,
    importance: m.importance ?? null,
    confidence: m.confidence ?? null,
    tags: m.tags ? [...m.tags].sort() : null,
    sessionId: m.sessionId ?? null,
    projectId: m.projectId ?? null,
    sensitivity: m.sensitivity ?? "normal",
    metadata: m.metadata ?? null,
    createdAt: m.createdAt ?? null,
    updatedAt: m.updatedAt ?? null,
  }));
  return JSON.stringify(normalized);
}

export function computeChecksum(memories: MemoryBackupRecord[]): string {
  return createHash("sha256")
    .update(canonicalMemoriesJson(memories), "utf8")
    .digest("hex");
}

export function recordToBackupRecord(record: MemoryRecord): MemoryBackupRecord {
  if (!isLongTermType(record.type)) {
    throw new Error(`Cannot backup working memory: ${record.id}`);
  }
  return {
    id: record.id,
    type: record.type,
    content: record.content,
    importance: record.importance,
    confidence: record.confidence,
    tags: record.tags,
    sessionId: record.sessionId,
    projectId: record.projectId,
    sensitivity: record.sensitivity ?? "normal",
    metadata: record.metadata,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function buildSnapshot(
  records: MemoryRecord[],
  exportedAt: string = new Date().toISOString(),
): MemoryBackupSnapshot {
  const memories = records.map(recordToBackupRecord);
  return {
    format: MEMORY_BACKUP_FORMAT,
    version: MEMORY_BACKUP_VERSION,
    exportedAt,
    count: memories.length,
    checksum: computeChecksum(memories),
    memories,
  };
}

export function validateSnapshot(input: unknown): BackupValidationResult {
  const errors: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["Backup must be a JSON object"] };
  }
  const snap = input as Record<string, unknown>;

  if (snap.format !== MEMORY_BACKUP_FORMAT) {
    errors.push(`Invalid format (expected ${MEMORY_BACKUP_FORMAT})`);
  }
  if (snap.version !== MEMORY_BACKUP_VERSION) {
    errors.push(`Unsupported backup version: ${String(snap.version)}`);
  }
  if (typeof snap.exportedAt !== "string" || !snap.exportedAt) {
    errors.push("Missing exportedAt");
  }
  if (!Array.isArray(snap.memories)) {
    errors.push("memories must be an array");
    return { ok: false, errors };
  }

  const memories = snap.memories as MemoryBackupRecord[];
  if (typeof snap.count !== "number" || snap.count !== memories.length) {
    errors.push(
      `count mismatch (declared ${String(snap.count)}, actual ${memories.length})`,
    );
  }
  if (
    typeof snap.checksum !== "string" ||
    !/^[a-f0-9]{64}$/i.test(snap.checksum)
  ) {
    errors.push("Missing or invalid checksum");
  }

  for (let i = 0; i < memories.length; i += 1) {
    const m = memories[i];
    if (!m || typeof m !== "object") {
      errors.push(`memories[${i}] is not an object`);
      continue;
    }
    if (typeof m.id !== "string" || !m.id) {
      errors.push(`memories[${i}].id is required`);
    }
    if (
      m.type !== "episodic" &&
      m.type !== "semantic" &&
      m.type !== "procedural"
    ) {
      errors.push(`memories[${i}].type is invalid`);
    }
    if (typeof m.content !== "string") {
      errors.push(`memories[${i}].content is required`);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const expected = computeChecksum(memories);
  const actual = (snap.checksum as string).toLowerCase();
  if (expected !== actual) {
    return {
      ok: false,
      errors: ["Checksum mismatch — backup may be tampered or corrupt"],
    };
  }

  return {
    ok: true,
    errors: [],
    snapshot: {
      format: MEMORY_BACKUP_FORMAT,
      version: MEMORY_BACKUP_VERSION,
      exportedAt: snap.exportedAt as string,
      count: memories.length,
      checksum: expected,
      memories,
    },
  };
}
