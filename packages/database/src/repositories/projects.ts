/**
 * Persistent workspace projects (ADR-0051).
 */
import { randomUUID } from "node:crypto";

import type { SqliteDatabase } from "../client.js";

export interface ProjectRow {
  id: string;
  userId: string;
  name: string;
  path: string;
  repoUrl?: string;
  defaultBranch?: string;
  metadata: Record<string, unknown>;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectUpsertInput {
  id?: string;
  userId?: string;
  name: string;
  path: string;
  repoUrl?: string | null;
  defaultBranch?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ProjectListQuery {
  userId?: string;
  limit?: number;
}

interface ProjectSqlRow {
  id: string;
  user_id: string;
  name: string;
  path: string;
  repo_url: string | null;
  default_branch: string | null;
  metadata: string | null;
  last_seen_at: string;
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

function toRow(row: ProjectSqlRow): ProjectRow {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    path: row.path,
    repoUrl: row.repo_url ?? undefined,
    defaultBranch: row.default_branch ?? undefined,
    metadata: parseMetadata(row.metadata),
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ProjectsRepository {
  constructor(private readonly db: SqliteDatabase) {}

  get(id: string): ProjectRow | undefined {
    const row = this.db
      .prepare("SELECT * FROM projects WHERE id = ?")
      .get(id) as ProjectSqlRow | undefined;
    return row ? toRow(row) : undefined;
  }

  getByPath(path: string, userId = "local"): ProjectRow | undefined {
    const row = this.db
      .prepare("SELECT * FROM projects WHERE user_id = ? AND path = ?")
      .get(userId, path) as ProjectSqlRow | undefined;
    return row ? toRow(row) : undefined;
  }

  upsertByPath(input: ProjectUpsertInput): ProjectRow {
    const path = input.path.trim();
    if (!path) {
      throw new Error("Project path is required");
    }
    const name = input.name.trim() || basenameFromPath(path);
    const userId = input.userId ?? "local";
    const now = new Date().toISOString();
    const existing = this.getByPath(path, userId);
    const id = input.id?.trim() || existing?.id || `proj_${randomUUID()}`;
    const createdAt = existing?.createdAt ?? now;
    const metadata = JSON.stringify(input.metadata ?? existing?.metadata ?? {});
    const repoUrl =
      input.repoUrl !== undefined ? input.repoUrl : (existing?.repoUrl ?? null);
    const defaultBranch =
      input.defaultBranch !== undefined
        ? input.defaultBranch
        : (existing?.defaultBranch ?? null);

    this.db
      .prepare(
        `
        INSERT INTO projects (
          id, user_id, name, path, repo_url, default_branch,
          metadata, last_seen_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, path) DO UPDATE SET
          name = excluded.name,
          repo_url = excluded.repo_url,
          default_branch = excluded.default_branch,
          metadata = excluded.metadata,
          last_seen_at = excluded.last_seen_at,
          updated_at = excluded.updated_at
      `,
      )
      .run(
        id,
        userId,
        name,
        path,
        repoUrl,
        defaultBranch,
        metadata,
        now,
        createdAt,
        now,
      );

    const row = this.getByPath(path, userId);
    if (!row) {
      throw new Error(`Failed to upsert project: ${path}`);
    }
    return row;
  }

  touch(id: string): ProjectRow | undefined {
    const existing = this.get(id);
    if (!existing) {
      return undefined;
    }
    const now = new Date().toISOString();
    this.db
      .prepare(
        "UPDATE projects SET last_seen_at = ?, updated_at = ? WHERE id = ?",
      )
      .run(now, now, id);
    return this.get(id);
  }

  updateMetadata(
    id: string,
    metadata: Record<string, unknown>,
  ): ProjectRow | undefined {
    const existing = this.get(id);
    if (!existing) {
      return undefined;
    }
    const now = new Date().toISOString();
    this.db
      .prepare("UPDATE projects SET metadata = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(metadata), now, id);
    return this.get(id);
  }

  list(query: ProjectListQuery = {}): ProjectRow[] {
    const userId = query.userId ?? "local";
    const limit = Math.max(1, query.limit ?? 100);
    const rows = this.db
      .prepare(
        `
        SELECT * FROM projects
        WHERE user_id = ?
        ORDER BY last_seen_at DESC
        LIMIT ?
      `,
      )
      .all(userId, limit) as unknown as ProjectSqlRow[];
    return rows.map(toRow);
  }

  delete(id: string): boolean {
    const result = this.db.prepare("DELETE FROM projects WHERE id = ?").run(id);
    return Number(result.changes) > 0;
  }
}

function basenameFromPath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts.at(-1) ?? path;
}
