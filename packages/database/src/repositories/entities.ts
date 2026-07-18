/**
 * Knowledge graph entities (Architecture/23, schema v6).
 */
import { randomUUID } from "node:crypto";

import type { SqliteDatabase } from "../client.js";

export interface EntityRecordInput {
  id?: string;
  userId?: string;
  type: string;
  name: string;
  properties?: Record<string, unknown>;
}

export interface EntityUpdateInput {
  name?: string;
  type?: string;
  properties?: Record<string, unknown>;
}

export interface EntityRow {
  id: string;
  userId: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EntityListQuery {
  userId?: string;
  type?: string;
  name?: string;
  limit?: number;
}

interface EntitySqlRow {
  id: string;
  user_id: string;
  type: string;
  name: string;
  properties: string | null;
  created_at: string;
  updated_at: string;
}

function parseProperties(raw: string | null): Record<string, unknown> {
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

export class EntitiesRepository {
  constructor(private readonly db: SqliteDatabase) {}

  upsert(input: EntityRecordInput): EntityRow {
    const type = input.type?.trim();
    const name = input.name?.trim();
    if (!type) {
      throw new Error("Entity type is required");
    }
    if (!name) {
      throw new Error("Entity name is required");
    }

    const now = new Date().toISOString();
    const userId = input.userId?.trim() || "local";

    // Prefer id if provided; otherwise upsert by (userId, type, name).
    let existing: EntityRow | undefined;
    if (input.id?.trim()) {
      existing = this.get(input.id.trim());
    } else {
      existing = this.findByKey(userId, type, name);
    }

    const id = existing?.id ?? input.id?.trim() ?? randomUUID();
    const createdAt = existing?.createdAt ?? now;
    const properties = JSON.stringify(
      input.properties ?? existing?.properties ?? {},
    );

    this.db
      .prepare(
        `
        INSERT INTO entities (
          id, user_id, type, name, properties, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          type = excluded.type,
          name = excluded.name,
          properties = excluded.properties,
          updated_at = excluded.updated_at
      `,
      )
      .run(id, userId, type, name, properties, createdAt, now);

    const row = this.get(id);
    if (!row) {
      throw new Error(`Failed to upsert entity: ${id}`);
    }
    return row;
  }

  get(id: string): EntityRow | undefined {
    const row = this.db
      .prepare("SELECT * FROM entities WHERE id = ?")
      .get(id) as EntitySqlRow | undefined;
    return row ? this.toRow(row) : undefined;
  }

  findByKey(userId: string, type: string, name: string): EntityRow | undefined {
    const row = this.db
      .prepare(
        "SELECT * FROM entities WHERE user_id = ? AND type = ? AND name = ?",
      )
      .get(userId, type, name) as EntitySqlRow | undefined;
    return row ? this.toRow(row) : undefined;
  }

  update(id: string, patch: EntityUpdateInput): EntityRow {
    const existing = this.get(id);
    if (!existing) {
      throw new Error(`Entity not found: ${id}`);
    }
    const type = patch.type !== undefined ? patch.type.trim() : existing.type;
    const name = patch.name !== undefined ? patch.name.trim() : existing.name;
    if (!type) {
      throw new Error("Entity type is required");
    }
    if (!name) {
      throw new Error("Entity name is required");
    }
    const now = new Date().toISOString();
    const properties =
      patch.properties !== undefined
        ? JSON.stringify(patch.properties)
        : JSON.stringify(existing.properties);

    this.db
      .prepare(
        `
        UPDATE entities SET
          type = ?,
          name = ?,
          properties = ?,
          updated_at = ?
        WHERE id = ?
      `,
      )
      .run(type, name, properties, now, id);

    const row = this.get(id);
    if (!row) {
      throw new Error(`Failed to update entity: ${id}`);
    }
    return row;
  }

  delete(id: string): boolean {
    const result = this.db.prepare("DELETE FROM entities WHERE id = ?").run(id);
    return Number(result.changes) > 0;
  }

  list(query: EntityListQuery = {}): EntityRow[] {
    const userId = query.userId ?? "local";
    const limit = Math.max(1, query.limit ?? 100);
    let sql = "SELECT * FROM entities WHERE user_id = ?";
    const params: Array<string | number> = [userId];

    if (query.type?.trim()) {
      sql += " AND type = ?";
      params.push(query.type.trim());
    }
    if (query.name?.trim()) {
      sql += " AND name LIKE ? COLLATE NOCASE";
      params.push(`%${query.name.trim()}%`);
    }

    sql += " ORDER BY updated_at DESC LIMIT ?";
    params.push(limit);

    return (
      this.db.prepare(sql).all(...params) as unknown as EntitySqlRow[]
    ).map((r) => this.toRow(r));
  }

  private toRow(row: EntitySqlRow): EntityRow {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      name: row.name,
      properties: parseProperties(row.properties),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
