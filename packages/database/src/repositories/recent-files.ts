/**
 * Recent files MRU index (ADR-0085).
 */
import { randomUUID } from "node:crypto";

import type { SqliteDatabase } from "../client.js";

export type RecentFileAction = "read" | "write";

export interface RecentFileRow {
  id: string;
  userId: string;
  path: string;
  lastAction: RecentFileAction;
  lastAccessedAt: string;
  accessCount: number;
}

export interface RecentFileTouchInput {
  path: string;
  action: RecentFileAction;
  at?: string;
  userId?: string;
}

export type RecentFilesSort = "recent" | "frequent";

export interface RecentFilesListQuery {
  userId?: string;
  limit?: number;
  offset?: number;
  sort?: RecentFilesSort;
  pathPrefix?: string;
  action?: RecentFileAction;
  since?: string;
}

interface RecentFileSqlRow {
  id: string;
  user_id: string;
  path: string;
  last_action: string;
  last_accessed_at: string;
  access_count: number;
}

function toRow(row: RecentFileSqlRow): RecentFileRow {
  return {
    id: row.id,
    userId: row.user_id,
    path: row.path,
    lastAction: row.last_action === "write" ? "write" : "read",
    lastAccessedAt: row.last_accessed_at,
    accessCount: row.access_count,
  };
}

export class RecentFilesRepository {
  constructor(private readonly db: SqliteDatabase) {}

  getByPath(path: string, userId = "local"): RecentFileRow | undefined {
    const row = this.db
      .prepare("SELECT * FROM recent_files WHERE user_id = ? AND path = ?")
      .get(userId, path) as RecentFileSqlRow | undefined;
    return row ? toRow(row) : undefined;
  }

  touch(input: RecentFileTouchInput): RecentFileRow {
    const path = input.path.trim();
    if (!path) {
      throw new Error("Recent file path is required");
    }
    const userId = input.userId ?? "local";
    const at = input.at ?? new Date().toISOString();
    const action = input.action;
    const existing = this.getByPath(path, userId);
    const id = existing?.id ?? `rf_${randomUUID()}`;
    const accessCount = (existing?.accessCount ?? 0) + 1;

    this.db
      .prepare(
        `
        INSERT INTO recent_files (
          id, user_id, path, last_action, last_accessed_at, access_count
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, path) DO UPDATE SET
          last_action = excluded.last_action,
          last_accessed_at = excluded.last_accessed_at,
          access_count = recent_files.access_count + 1
      `,
      )
      .run(id, userId, path, action, at, accessCount);

    const row = this.getByPath(path, userId);
    if (!row) {
      throw new Error(`Failed to touch recent file: ${path}`);
    }
    return row;
  }

  list(query: RecentFilesListQuery = {}): RecentFileRow[] {
    const userId = query.userId ?? "local";
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 500);
    const offset = Math.max(query.offset ?? 0, 0);
    const sort = query.sort ?? "recent";
    const orderBy =
      sort === "frequent"
        ? "access_count DESC, last_accessed_at DESC"
        : "last_accessed_at DESC";

    const clauses = ["user_id = ?"];
    const params: Array<string | number> = [userId];

    if (query.pathPrefix) {
      clauses.push("path LIKE ?");
      params.push(`${query.pathPrefix}%`);
    }
    if (query.action) {
      clauses.push("last_action = ?");
      params.push(query.action);
    }
    if (query.since) {
      clauses.push("last_accessed_at >= ?");
      params.push(query.since);
    }

    params.push(limit, offset);
    const rows = this.db
      .prepare(
        `
        SELECT * FROM recent_files
        WHERE ${clauses.join(" AND ")}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `,
      )
      .all(...params) as unknown as RecentFileSqlRow[];

    return rows.map(toRow);
  }

  remove(path: string, userId = "local"): boolean {
    const result = this.db
      .prepare("DELETE FROM recent_files WHERE user_id = ? AND path = ?")
      .run(userId, path);
    return Number(result.changes) > 0;
  }

  clear(userId = "local"): number {
    const result = this.db
      .prepare("DELETE FROM recent_files WHERE user_id = ?")
      .run(userId);
    return Number(result.changes);
  }
}
