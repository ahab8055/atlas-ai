/**
 * File content index metadata + FTS5 (ADR-0087).
 */
import { randomUUID } from "node:crypto";

import type { SqliteDatabase } from "../client.js";

export type IndexedFileStatus = "pending" | "indexed" | "skipped" | "error";

export interface IndexedFileRow {
  id: string;
  userId: string;
  path: string;
  name: string;
  extension?: string;
  size?: number;
  mtimeMs?: number;
  contentHash?: string;
  projectId?: string;
  status: IndexedFileStatus;
  errorMessage?: string;
  indexedAt: string;
  updatedAt: string;
}

export interface IndexedFileUpsertInput {
  path: string;
  name: string;
  extension?: string | null;
  size?: number | null;
  mtimeMs?: number | null;
  contentHash?: string | null;
  /** Indexed text body (empty for skipped/error without content). */
  content?: string;
  projectId?: string | null;
  status?: IndexedFileStatus;
  errorMessage?: string | null;
  userId?: string;
  at?: string;
}

export interface IndexedFilesListQuery {
  userId?: string;
  status?: IndexedFileStatus;
  limit?: number;
  offset?: number;
}

export interface IndexedFilesFtsQuery {
  query: string;
  userId?: string;
  limit?: number;
}

export interface IndexedFileSearchHit {
  path: string;
  name: string;
  rank: number;
  snippet?: string;
}

export interface IndexedFilesStatusSummary {
  total: number;
  indexed: number;
  skipped: number;
  error: number;
  pending: number;
  lastIndexedAt?: string;
}

interface IndexedFileSqlRow {
  id: string;
  user_id: string;
  path: string;
  name: string;
  extension: string | null;
  size: number | null;
  mtime_ms: number | null;
  content_hash: string | null;
  project_id: string | null;
  status: string;
  error_message: string | null;
  indexed_at: string;
  updated_at: string;
}

function toStatus(raw: string): IndexedFileStatus {
  if (
    raw === "pending" ||
    raw === "indexed" ||
    raw === "skipped" ||
    raw === "error"
  ) {
    return raw;
  }
  return "indexed";
}

function toRow(row: IndexedFileSqlRow): IndexedFileRow {
  return {
    id: row.id,
    userId: row.user_id,
    path: row.path,
    name: row.name,
    extension: row.extension ?? undefined,
    size: row.size ?? undefined,
    mtimeMs: row.mtime_ms ?? undefined,
    contentHash: row.content_hash ?? undefined,
    projectId: row.project_id ?? undefined,
    status: toStatus(row.status),
    errorMessage: row.error_message ?? undefined,
    indexedAt: row.indexed_at,
    updatedAt: row.updated_at,
  };
}

function basenameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx >= 0 ? normalized.slice(idx + 1) : normalized;
}

export class IndexedFilesRepository {
  constructor(private readonly db: SqliteDatabase) {}

  getByPath(path: string, userId = "local"): IndexedFileRow | undefined {
    const row = this.db
      .prepare("SELECT * FROM indexed_files WHERE user_id = ? AND path = ?")
      .get(userId, path) as IndexedFileSqlRow | undefined;
    return row ? toRow(row) : undefined;
  }

  upsertWithContent(input: IndexedFileUpsertInput): IndexedFileRow {
    const path = input.path.trim();
    if (!path) {
      throw new Error("Indexed file path is required");
    }
    const userId = input.userId ?? "local";
    const at = input.at ?? new Date().toISOString();
    const name = input.name.trim() || basenameFromPath(path);
    const status = input.status ?? "indexed";
    const content = input.content ?? "";
    const existing = this.getByPath(path, userId);
    const id = existing?.id ?? `idx_${randomUUID()}`;
    const indexedAt = existing?.indexedAt ?? at;

    this.db
      .prepare(
        `
        INSERT INTO indexed_files (
          id, user_id, path, name, extension, size, mtime_ms, content_hash,
          project_id, status, error_message, indexed_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, path) DO UPDATE SET
          name = excluded.name,
          extension = excluded.extension,
          size = excluded.size,
          mtime_ms = excluded.mtime_ms,
          content_hash = excluded.content_hash,
          project_id = excluded.project_id,
          status = excluded.status,
          error_message = excluded.error_message,
          updated_at = excluded.updated_at
      `,
      )
      .run(
        id,
        userId,
        path,
        name,
        input.extension ?? null,
        input.size ?? null,
        input.mtimeMs ?? null,
        input.contentHash ?? null,
        input.projectId ?? null,
        status,
        input.errorMessage ?? null,
        indexedAt,
        at,
      );

    // Path-keyed FTS sync
    this.db.prepare("DELETE FROM indexed_files_fts WHERE path = ?").run(path);
    if (status === "indexed" && content.length > 0) {
      this.db
        .prepare(
          `
          INSERT INTO indexed_files_fts (path, name, content)
          VALUES (?, ?, ?)
        `,
        )
        .run(path, name, content);
    } else if (status === "indexed") {
      // Still searchable by path/name
      this.db
        .prepare(
          `
          INSERT INTO indexed_files_fts (path, name, content)
          VALUES (?, ?, ?)
        `,
        )
        .run(path, name, "");
    }

    const row = this.getByPath(path, userId);
    if (!row) {
      throw new Error(`Failed to upsert indexed file: ${path}`);
    }
    return row;
  }

  remove(path: string, userId = "local"): boolean {
    this.db.prepare("DELETE FROM indexed_files_fts WHERE path = ?").run(path);
    const result = this.db
      .prepare("DELETE FROM indexed_files WHERE user_id = ? AND path = ?")
      .run(userId, path);
    return Number(result.changes) > 0;
  }

  removeByPrefix(dirPrefix: string, userId = "local"): number {
    const prefix = dirPrefix.endsWith("/") ? dirPrefix : `${dirPrefix}/`;
    const rows = this.db
      .prepare(
        `
        SELECT path FROM indexed_files
        WHERE user_id = ? AND (path = ? OR path LIKE ?)
      `,
      )
      .all(userId, dirPrefix, `${prefix}%`) as Array<{ path: string }>;

    for (const row of rows) {
      this.db
        .prepare("DELETE FROM indexed_files_fts WHERE path = ?")
        .run(row.path);
    }
    const result = this.db
      .prepare(
        `
        DELETE FROM indexed_files
        WHERE user_id = ? AND (path = ? OR path LIKE ?)
      `,
      )
      .run(userId, dirPrefix, `${prefix}%`);
    return Number(result.changes);
  }

  list(query: IndexedFilesListQuery = {}): IndexedFileRow[] {
    const userId = query.userId ?? "local";
    const limit = Math.min(Math.max(query.limit ?? 100, 1), 1000);
    const offset = Math.max(query.offset ?? 0, 0);
    const clauses = ["user_id = ?"];
    const params: Array<string | number> = [userId];
    if (query.status) {
      clauses.push("status = ?");
      params.push(query.status);
    }
    params.push(limit, offset);
    const rows = this.db
      .prepare(
        `
        SELECT * FROM indexed_files
        WHERE ${clauses.join(" AND ")}
        ORDER BY updated_at DESC
        LIMIT ? OFFSET ?
      `,
      )
      .all(...params) as unknown as IndexedFileSqlRow[];
    return rows.map(toRow);
  }

  searchFts(query: IndexedFilesFtsQuery): IndexedFileSearchHit[] {
    const raw = query.query.trim();
    if (!raw) {
      return [];
    }
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    // Escape FTS5 special chars for simple phrase/token queries
    const matchQuery = raw
      .replace(/["']/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => `"${t.replace(/"/g, "")}"`)
      .join(" ");
    if (!matchQuery) {
      return [];
    }

    const rows = this.db
      .prepare(
        `
        SELECT
          f.path AS path,
          f.name AS name,
          bm25(indexed_files_fts) AS rank,
          snippet(indexed_files_fts, 2, '', '', '…', 32) AS snippet
        FROM indexed_files_fts
        JOIN indexed_files f ON f.path = indexed_files_fts.path
        WHERE indexed_files_fts MATCH ?
          AND f.user_id = ?
          AND f.status = 'indexed'
        ORDER BY rank
        LIMIT ?
      `,
      )
      .all(matchQuery, query.userId ?? "local", limit) as Array<{
      path: string;
      name: string;
      rank: number;
      snippet: string | null;
    }>;

    return rows.map((r) => ({
      path: r.path,
      name: r.name,
      rank: Number(r.rank),
      snippet: r.snippet ?? undefined,
    }));
  }

  statusSummary(userId = "local"): IndexedFilesStatusSummary {
    const counts = this.db
      .prepare(
        `
        SELECT status, COUNT(*) AS n
        FROM indexed_files
        WHERE user_id = ?
        GROUP BY status
      `,
      )
      .all(userId) as Array<{ status: string; n: number | bigint }>;

    const summary: IndexedFilesStatusSummary = {
      total: 0,
      indexed: 0,
      skipped: 0,
      error: 0,
      pending: 0,
    };
    for (const row of counts) {
      const n = Number(row.n);
      summary.total += n;
      if (row.status === "indexed") summary.indexed = n;
      else if (row.status === "skipped") summary.skipped = n;
      else if (row.status === "error") summary.error = n;
      else if (row.status === "pending") summary.pending = n;
    }

    const last = this.db
      .prepare(
        `
        SELECT MAX(indexed_at) AS last_indexed_at
        FROM indexed_files
        WHERE user_id = ? AND status = 'indexed'
      `,
      )
      .get(userId) as { last_indexed_at: string | null } | undefined;
    summary.lastIndexedAt = last?.last_indexed_at ?? undefined;
    return summary;
  }
}
