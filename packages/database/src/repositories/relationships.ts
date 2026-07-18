/**
 * Knowledge graph relationships (Architecture/23, schema v6).
 */
import { randomUUID } from "node:crypto";

import type { SqliteDatabase } from "../client.js";
import { EntitiesRepository } from "./entities.js";

export interface RelationshipRecordInput {
  id?: string;
  userId?: string;
  fromEntityId: string;
  toEntityId: string;
  type: string;
  weight?: number;
  properties?: Record<string, unknown>;
}

export interface RelationshipUpdateInput {
  type?: string;
  weight?: number | null;
  properties?: Record<string, unknown>;
}

export interface RelationshipRow {
  id: string;
  userId: string;
  fromEntityId: string;
  toEntityId: string;
  type: string;
  weight?: number;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RelationshipListQuery {
  userId?: string;
  fromEntityId?: string;
  toEntityId?: string;
  type?: string;
  types?: string[];
  limit?: number;
}

export type NeighborDirection = "out" | "in" | "both";

export interface NeighborQuery {
  userId?: string;
  direction?: NeighborDirection;
  types?: string[];
  limit?: number;
}

export interface NeighborEdge {
  relationship: RelationshipRow;
  entityId: string;
}

interface RelationshipSqlRow {
  id: string;
  user_id: string;
  from_entity_id: string;
  to_entity_id: string;
  type: string;
  weight: number | null;
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

function normalizeWeight(weight: number | undefined): number | null {
  if (weight === undefined) {
    return null;
  }
  if (!Number.isFinite(weight) || weight < 0 || weight > 1) {
    throw new Error("Relationship weight must be between 0 and 1");
  }
  return weight;
}

export class RelationshipsRepository {
  private readonly entities: EntitiesRepository;

  constructor(private readonly db: SqliteDatabase) {
    this.entities = new EntitiesRepository(db);
  }

  upsert(input: RelationshipRecordInput): RelationshipRow {
    const type = input.type?.trim();
    const fromEntityId = input.fromEntityId?.trim();
    const toEntityId = input.toEntityId?.trim();
    if (!type) {
      throw new Error("Relationship type is required");
    }
    if (!fromEntityId || !toEntityId) {
      throw new Error("Relationship endpoints are required");
    }
    if (fromEntityId === toEntityId) {
      throw new Error("Relationship endpoints must be distinct");
    }

    const from = this.entities.get(fromEntityId);
    const to = this.entities.get(toEntityId);
    if (!from || !to) {
      throw new Error(
        "Relationship endpoints must reference existing entities",
      );
    }

    const now = new Date().toISOString();
    const userId = input.userId?.trim() || from.userId || "local";

    let existing: RelationshipRow | undefined;
    if (input.id?.trim()) {
      existing = this.get(input.id.trim());
    } else {
      existing = this.findByKey(userId, fromEntityId, toEntityId, type);
    }

    const id = existing?.id ?? input.id?.trim() ?? randomUUID();
    const createdAt = existing?.createdAt ?? now;
    const weight =
      input.weight !== undefined
        ? normalizeWeight(input.weight)
        : (existing?.weight ?? null);
    const properties = JSON.stringify(
      input.properties ?? existing?.properties ?? {},
    );

    this.db
      .prepare(
        `
        INSERT INTO relationships (
          id, user_id, from_entity_id, to_entity_id, type, weight,
          properties, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          user_id = excluded.user_id,
          from_entity_id = excluded.from_entity_id,
          to_entity_id = excluded.to_entity_id,
          type = excluded.type,
          weight = excluded.weight,
          properties = excluded.properties,
          updated_at = excluded.updated_at
      `,
      )
      .run(
        id,
        userId,
        fromEntityId,
        toEntityId,
        type,
        weight,
        properties,
        createdAt,
        now,
      );

    const row = this.get(id);
    if (!row) {
      throw new Error(`Failed to upsert relationship: ${id}`);
    }
    return row;
  }

  get(id: string): RelationshipRow | undefined {
    const row = this.db
      .prepare("SELECT * FROM relationships WHERE id = ?")
      .get(id) as RelationshipSqlRow | undefined;
    return row ? this.toRow(row) : undefined;
  }

  findByKey(
    userId: string,
    fromEntityId: string,
    toEntityId: string,
    type: string,
  ): RelationshipRow | undefined {
    const row = this.db
      .prepare(
        `
        SELECT * FROM relationships
        WHERE user_id = ? AND from_entity_id = ? AND to_entity_id = ? AND type = ?
      `,
      )
      .get(userId, fromEntityId, toEntityId, type) as
      RelationshipSqlRow | undefined;
    return row ? this.toRow(row) : undefined;
  }

  update(id: string, patch: RelationshipUpdateInput): RelationshipRow {
    const existing = this.get(id);
    if (!existing) {
      throw new Error(`Relationship not found: ${id}`);
    }
    const type = patch.type !== undefined ? patch.type.trim() : existing.type;
    if (!type) {
      throw new Error("Relationship type is required");
    }
    const now = new Date().toISOString();
    let weight: number | null;
    if (patch.weight === null) {
      weight = null;
    } else if (patch.weight !== undefined) {
      weight = normalizeWeight(patch.weight);
    } else {
      weight = existing.weight ?? null;
    }
    const properties =
      patch.properties !== undefined
        ? JSON.stringify(patch.properties)
        : JSON.stringify(existing.properties);

    this.db
      .prepare(
        `
        UPDATE relationships SET
          type = ?,
          weight = ?,
          properties = ?,
          updated_at = ?
        WHERE id = ?
      `,
      )
      .run(type, weight, properties, now, id);

    const row = this.get(id);
    if (!row) {
      throw new Error(`Failed to update relationship: ${id}`);
    }
    return row;
  }

  delete(id: string): boolean {
    const result = this.db
      .prepare("DELETE FROM relationships WHERE id = ?")
      .run(id);
    return Number(result.changes) > 0;
  }

  list(query: RelationshipListQuery = {}): RelationshipRow[] {
    const userId = query.userId ?? "local";
    const limit = Math.max(1, query.limit ?? 200);
    let sql = "SELECT * FROM relationships WHERE user_id = ?";
    const params: Array<string | number> = [userId];

    if (query.fromEntityId?.trim()) {
      sql += " AND from_entity_id = ?";
      params.push(query.fromEntityId.trim());
    }
    if (query.toEntityId?.trim()) {
      sql += " AND to_entity_id = ?";
      params.push(query.toEntityId.trim());
    }
    if (query.type?.trim()) {
      sql += " AND type = ?";
      params.push(query.type.trim());
    } else if (query.types && query.types.length > 0) {
      const placeholders = query.types.map(() => "?").join(", ");
      sql += ` AND type IN (${placeholders})`;
      params.push(...query.types);
    }

    sql += " ORDER BY updated_at DESC LIMIT ?";
    params.push(limit);

    return (
      this.db.prepare(sql).all(...params) as unknown as RelationshipSqlRow[]
    ).map((r) => this.toRow(r));
  }

  /**
   * 1-hop neighbors of an entity.
   */
  neighbors(entityId: string, query: NeighborQuery = {}): NeighborEdge[] {
    const userId = query.userId ?? "local";
    const direction = query.direction ?? "both";
    const limit = Math.max(1, query.limit ?? 100);
    const edges: NeighborEdge[] = [];

    const typeFilter = (rows: RelationshipRow[]): RelationshipRow[] => {
      if (!query.types || query.types.length === 0) {
        return rows;
      }
      const allowed = new Set(query.types);
      return rows.filter((r) => allowed.has(r.type));
    };

    if (direction === "out" || direction === "both") {
      const out = typeFilter(
        this.list({ userId, fromEntityId: entityId, limit }),
      );
      for (const relationship of out) {
        edges.push({ relationship, entityId: relationship.toEntityId });
      }
    }
    if (direction === "in" || direction === "both") {
      const inbound = typeFilter(
        this.list({ userId, toEntityId: entityId, limit }),
      );
      for (const relationship of inbound) {
        edges.push({ relationship, entityId: relationship.fromEntityId });
      }
    }

    return edges.slice(0, limit);
  }

  private toRow(row: RelationshipSqlRow): RelationshipRow {
    return {
      id: row.id,
      userId: row.user_id,
      fromEntityId: row.from_entity_id,
      toEntityId: row.to_entity_id,
      type: row.type,
      weight: row.weight ?? undefined,
      properties: parseProperties(row.properties),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
