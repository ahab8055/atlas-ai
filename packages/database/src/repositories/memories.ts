/**
 * Persistent long-term memories (Architecture/20 memories + memory_tags).
 */
import { randomUUID } from "node:crypto";

import type { SqliteDatabase } from "../client.js";

export type LongTermMemoryType = "episodic" | "semantic" | "procedural";

export type MemorySensitivity = "normal" | "sensitive";

export interface MemoryRecordInput {
  id?: string;
  userId?: string;
  type: LongTermMemoryType;
  content: string;
  importance?: number;
  confidence?: number;
  source?: string;
  sessionId?: string;
  projectId?: string;
  sensitivity?: MemorySensitivity;
  encrypted?: boolean;
  contentNonce?: string | null;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface MemoryRow {
  id: string;
  userId: string;
  type: LongTermMemoryType;
  content: string;
  importance?: number;
  confidence?: number;
  source?: string;
  sessionId?: string;
  projectId?: string;
  sensitivity: MemorySensitivity;
  encrypted: boolean;
  contentNonce?: string;
  metadata: Record<string, unknown>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MemoryListQuery {
  userId?: string;
  type?: LongTermMemoryType;
  tags?: string[];
  sessionId?: string;
  /** Exact project match. */
  projectId?: string;
  /**
   * When set, return rows where project_id = value OR project_id IS NULL
   * (unscoped memories included for cross-project context).
   */
  projectIdOrUnscoped?: string;
  text?: string;
  limit?: number;
}

export interface MemoryUpdateInput {
  content?: string;
  importance?: number;
  confidence?: number;
  source?: string;
  sessionId?: string;
  projectId?: string | null;
  sensitivity?: MemorySensitivity;
  encrypted?: boolean;
  contentNonce?: string | null;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

/** Durable store aggregates for diagnostics (ADR-0058). */
export interface MemoryStoreStats {
  total: number;
  byType: Record<LongTermMemoryType, number>;
  sensitive: number;
  encrypted: number;
  /** Approx content storage: SUM(LENGTH(content)). */
  contentBytes: number;
}

interface MemorySqlRow {
  id: string;
  user_id: string;
  type: string;
  content: string;
  importance: number | null;
  confidence: number | null;
  source: string | null;
  session_id: string | null;
  project_id: string | null;
  sensitivity: string | null;
  encrypted: number | null;
  content_nonce: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
}

function parseMetadata(raw: string | null): Record<string, unknown> {
  if (!raw) {
    return {};
  }
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function assertLongTermType(type: string): LongTermMemoryType {
  if (type === "episodic" || type === "semantic" || type === "procedural") {
    return type;
  }
  throw new Error(`Invalid long-term memory type: ${type}`);
}

export class MemoriesRepository {
  constructor(private readonly db: SqliteDatabase) {}

  upsert(input: MemoryRecordInput): MemoryRow {
    const content = input.content?.trim();
    if (!content) {
      throw new Error("Memory content is required");
    }
    const type = assertLongTermType(input.type);
    const now = new Date().toISOString();
    const id = input.id?.trim() || randomUUID();
    const existing = this.get(id);
    const createdAt = existing?.createdAt ?? now;
    const userId = input.userId ?? existing?.userId ?? "local";
    const metadata = JSON.stringify(input.metadata ?? existing?.metadata ?? {});
    const sensitivity = assertSensitivity(
      input.sensitivity ?? existing?.sensitivity ?? "normal",
    );
    const encrypted =
      input.encrypted !== undefined
        ? input.encrypted
        : (existing?.encrypted ?? false);
    const contentNonce =
      input.contentNonce !== undefined
        ? input.contentNonce
        : (existing?.contentNonce ?? null);

    this.db
      .prepare(
        `
        INSERT INTO memories (
          id, user_id, type, content, importance, confidence,
          source, session_id, project_id, sensitivity, encrypted, content_nonce,
          metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          type = excluded.type,
          content = excluded.content,
          importance = excluded.importance,
          confidence = excluded.confidence,
          source = excluded.source,
          session_id = excluded.session_id,
          project_id = excluded.project_id,
          sensitivity = excluded.sensitivity,
          encrypted = excluded.encrypted,
          content_nonce = excluded.content_nonce,
          metadata = excluded.metadata,
          updated_at = excluded.updated_at
      `,
      )
      .run(
        id,
        userId,
        type,
        content,
        input.importance ?? existing?.importance ?? null,
        input.confidence ?? existing?.confidence ?? null,
        input.source ?? existing?.source ?? null,
        input.sessionId ?? existing?.sessionId ?? null,
        input.projectId ?? existing?.projectId ?? null,
        sensitivity,
        encrypted ? 1 : 0,
        contentNonce,
        metadata,
        createdAt,
        now,
      );

    if (input.tags !== undefined) {
      this.setTags(id, input.tags);
    } else if (!existing) {
      this.setTags(id, []);
    }

    const row = this.get(id);
    if (!row) {
      throw new Error(`Failed to upsert memory: ${id}`);
    }
    return row;
  }

  get(id: string): MemoryRow | undefined {
    const row = this.db
      .prepare("SELECT * FROM memories WHERE id = ?")
      .get(id) as MemorySqlRow | undefined;
    return row ? this.toRow(row) : undefined;
  }

  update(id: string, patch: MemoryUpdateInput): MemoryRow {
    const existing = this.get(id);
    if (!existing) {
      throw new Error(`Memory not found: ${id}`);
    }
    const content =
      patch.content !== undefined ? patch.content.trim() : existing.content;
    if (!content) {
      throw new Error("Memory content is required");
    }
    const now = new Date().toISOString();
    const metadata =
      patch.metadata !== undefined
        ? JSON.stringify(patch.metadata)
        : JSON.stringify(existing.metadata);

    this.db
      .prepare(
        `
        UPDATE memories SET
          content = ?,
          importance = ?,
          confidence = ?,
          source = ?,
          session_id = ?,
          project_id = ?,
          sensitivity = ?,
          encrypted = ?,
          content_nonce = ?,
          metadata = ?,
          updated_at = ?
        WHERE id = ?
      `,
      )
      .run(
        content,
        patch.importance !== undefined
          ? patch.importance
          : (existing.importance ?? null),
        patch.confidence !== undefined
          ? patch.confidence
          : (existing.confidence ?? null),
        patch.source !== undefined ? patch.source : (existing.source ?? null),
        patch.sessionId !== undefined
          ? patch.sessionId
          : (existing.sessionId ?? null),
        patch.projectId !== undefined
          ? patch.projectId
          : (existing.projectId ?? null),
        patch.sensitivity !== undefined
          ? assertSensitivity(patch.sensitivity)
          : existing.sensitivity,
        patch.encrypted !== undefined
          ? patch.encrypted
            ? 1
            : 0
          : existing.encrypted
            ? 1
            : 0,
        patch.contentNonce !== undefined
          ? patch.contentNonce
          : (existing.contentNonce ?? null),
        metadata,
        now,
        id,
      );

    if (patch.tags !== undefined) {
      this.setTags(id, patch.tags);
    }

    const row = this.get(id);
    if (!row) {
      throw new Error(`Failed to update memory: ${id}`);
    }
    return row;
  }

  delete(id: string): boolean {
    const result = this.db.prepare("DELETE FROM memories WHERE id = ?").run(id);
    return Number(result.changes) > 0;
  }

  clearByType(type: LongTermMemoryType, userId = "local"): number {
    const result = this.db
      .prepare("DELETE FROM memories WHERE type = ? AND user_id = ?")
      .run(type, userId);
    return Number(result.changes);
  }

  /** Aggregate counts and approximate content bytes for diagnostics. */
  stats(userId = "local"): MemoryStoreStats {
    const totals = this.db
      .prepare(
        `
        SELECT
          COUNT(*) AS total,
          COALESCE(SUM(LENGTH(content)), 0) AS content_bytes,
          COALESCE(SUM(CASE WHEN sensitivity = 'sensitive' THEN 1 ELSE 0 END), 0) AS sensitive,
          COALESCE(SUM(CASE WHEN encrypted = 1 THEN 1 ELSE 0 END), 0) AS encrypted
        FROM memories
        WHERE user_id = ?
      `,
      )
      .get(userId) as {
      total: number;
      content_bytes: number;
      sensitive: number;
      encrypted: number;
    };

    const byTypeRows = this.db
      .prepare(
        `
        SELECT type, COUNT(*) AS count
        FROM memories
        WHERE user_id = ?
        GROUP BY type
      `,
      )
      .all(userId) as Array<{ type: string; count: number }>;

    const byType: Record<LongTermMemoryType, number> = {
      episodic: 0,
      semantic: 0,
      procedural: 0,
    };
    for (const row of byTypeRows) {
      if (
        row.type === "episodic" ||
        row.type === "semantic" ||
        row.type === "procedural"
      ) {
        byType[row.type] = Number(row.count);
      }
    }

    return {
      total: Number(totals.total),
      byType,
      sensitive: Number(totals.sensitive),
      encrypted: Number(totals.encrypted),
      contentBytes: Number(totals.content_bytes),
    };
  }

  setTags(memoryId: string, tags: string[]): void {
    this.db
      .prepare("DELETE FROM memory_tags WHERE memory_id = ?")
      .run(memoryId);
    const insert = this.db.prepare(
      "INSERT INTO memory_tags (id, memory_id, tag) VALUES (?, ?, ?)",
    );
    const unique = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
    for (const tag of unique) {
      insert.run(randomUUID(), memoryId, tag);
    }
  }

  list(query: MemoryListQuery = {}): MemoryRow[] {
    const userId = query.userId ?? "local";
    const limit = Math.max(1, query.limit ?? 50);
    let sql = "SELECT * FROM memories WHERE user_id = ?";
    const params: Array<string | number> = [userId];

    if (query.type) {
      sql += " AND type = ?";
      params.push(query.type);
    }
    if (query.sessionId !== undefined) {
      sql += " AND session_id = ?";
      params.push(query.sessionId);
    }
    if (query.projectId !== undefined) {
      sql += " AND project_id = ?";
      params.push(query.projectId);
    } else if (query.projectIdOrUnscoped !== undefined) {
      sql += " AND (project_id = ? OR project_id IS NULL)";
      params.push(query.projectIdOrUnscoped);
    }
    if (query.tags && query.tags.length > 0) {
      const placeholders = query.tags.map(() => "?").join(", ");
      sql += ` AND id IN (
        SELECT memory_id FROM memory_tags WHERE tag IN (${placeholders})
      )`;
      params.push(...query.tags);
    }

    // Prefer project-scoped rows when filtering with projectIdOrUnscoped
    if (query.projectIdOrUnscoped !== undefined) {
      sql +=
        " ORDER BY CASE WHEN project_id IS NULL THEN 1 ELSE 0 END, updated_at DESC LIMIT ?";
    } else {
      sql += " ORDER BY updated_at DESC LIMIT ?";
    }
    params.push(limit);

    let rows = (
      this.db.prepare(sql).all(...params) as unknown as MemorySqlRow[]
    ).map((r) => this.toRow(r));

    if (query.text?.trim()) {
      rows = this.rankByRelevance(rows, query.text.trim());
    }

    return rows.slice(0, limit);
  }

  /** Rank candidates by token hits, importance, then recency. */
  rankByRelevance(rows: MemoryRow[], text: string): MemoryRow[] {
    const tokens = tokenize(text);
    return [...rows]
      .map((row) => ({
        row,
        score: scoreMemory(row, tokens),
      }))
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return b.row.updatedAt.localeCompare(a.row.updatedAt);
      })
      .map((entry) => entry.row);
  }

  private toRow(row: MemorySqlRow): MemoryRow {
    const tags = this.db
      .prepare("SELECT tag FROM memory_tags WHERE memory_id = ? ORDER BY tag")
      .all(row.id) as Array<{ tag: string }>;

    return {
      id: row.id,
      userId: row.user_id,
      type: assertLongTermType(row.type),
      content: row.content,
      importance: row.importance ?? undefined,
      confidence: row.confidence ?? undefined,
      source: row.source ?? undefined,
      sessionId: row.session_id ?? undefined,
      projectId: row.project_id ?? undefined,
      sensitivity: assertSensitivity(row.sensitivity ?? "normal"),
      encrypted: Number(row.encrypted ?? 0) === 1,
      contentNonce: row.content_nonce ?? undefined,
      metadata: parseMetadata(row.metadata),
      tags: tags.map((t) => t.tag),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

function assertSensitivity(value: string): MemorySensitivity {
  if (value === "normal" || value === "sensitive") {
    return value;
  }
  throw new Error(`Invalid memory sensitivity: ${value}`);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

function scoreMemory(row: MemoryRow, tokens: string[]): number {
  const hay = row.content.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (hay.includes(token)) {
      score += 1;
    }
  }
  if (row.tags.some((t) => tokens.includes(t.toLowerCase()))) {
    score += 0.5;
  }
  score += (row.importance ?? 0.5) * 0.5;
  score += (row.confidence ?? 0) * 0.1;
  return score;
}
