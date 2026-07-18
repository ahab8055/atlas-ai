/**
 * Preference observation counts for learning (ADR-0052).
 */
import { randomUUID } from "node:crypto";

import type { SqliteDatabase } from "../client.js";

export interface PreferenceObservationRow {
  id: string;
  userId: string;
  key: string;
  value: string;
  category: string;
  count: number;
  lastConfidence: number;
  lastSeenAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PreferenceObservationIncrementInput {
  userId?: string;
  key: string;
  value: string;
  category?: string;
  confidence?: number;
}

interface ObservationSqlRow {
  id: string;
  user_id: string;
  key: string;
  value: string;
  category: string;
  count: number;
  last_confidence: number;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

function toRow(row: ObservationSqlRow): PreferenceObservationRow {
  return {
    id: row.id,
    userId: row.user_id,
    key: row.key,
    value: row.value,
    category: row.category,
    count: row.count,
    lastConfidence: row.last_confidence,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PreferenceObservationsRepository {
  constructor(private readonly db: SqliteDatabase) {}

  get(
    key: string,
    value: string,
    userId = "local",
  ): PreferenceObservationRow | undefined {
    const row = this.db
      .prepare(
        "SELECT * FROM preference_observations WHERE user_id = ? AND key = ? AND value = ?",
      )
      .get(userId, key, value) as ObservationSqlRow | undefined;
    return row ? toRow(row) : undefined;
  }

  /** Increment count for (user, key, value); create row if missing. */
  increment(
    input: PreferenceObservationIncrementInput,
  ): PreferenceObservationRow {
    const userId = input.userId ?? "local";
    const key = input.key.trim();
    const value = input.value.trim();
    if (!key || !value) {
      throw new Error("Observation key and value are required");
    }
    const category = input.category ?? "general";
    const confidence = clamp01(input.confidence ?? 0);
    const now = new Date().toISOString();
    const existing = this.get(key, value, userId);

    if (existing) {
      this.db
        .prepare(
          `
          UPDATE preference_observations
          SET count = count + 1,
              last_confidence = ?,
              category = ?,
              last_seen_at = ?,
              updated_at = ?
          WHERE id = ?
        `,
        )
        .run(confidence, category, now, now, existing.id);
      return this.getById(existing.id)!;
    }

    const id = `pobs_${randomUUID()}`;
    this.db
      .prepare(
        `
        INSERT INTO preference_observations (
          id, user_id, key, value, category, count,
          last_confidence, last_seen_at, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
      `,
      )
      .run(id, userId, key, value, category, confidence, now, now, now);
    return this.getById(id)!;
  }

  /** Reset count (e.g. after reject so a new streak is required). */
  resetCount(
    key: string,
    value: string,
    userId = "local",
  ): PreferenceObservationRow | undefined {
    const existing = this.get(key, value, userId);
    if (!existing) {
      return undefined;
    }
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
        UPDATE preference_observations
        SET count = 0, updated_at = ?
        WHERE id = ?
      `,
      )
      .run(now, existing.id);
    return this.getById(existing.id);
  }

  list(
    options: {
      userId?: string;
      key?: string;
      minCount?: number;
      limit?: number;
    } = {},
  ): PreferenceObservationRow[] {
    const userId = options.userId ?? "local";
    const limit = Math.max(1, options.limit ?? 100);
    const params: Array<string | number> = [userId];
    let sql = "SELECT * FROM preference_observations WHERE user_id = ?";
    if (options.key) {
      sql += " AND key = ?";
      params.push(options.key);
    }
    if (options.minCount !== undefined) {
      sql += " AND count >= ?";
      params.push(options.minCount);
    }
    sql += " ORDER BY count DESC, last_seen_at DESC LIMIT ?";
    params.push(limit);
    const rows = this.db
      .prepare(sql)
      .all(...params) as unknown as ObservationSqlRow[];
    return rows.map(toRow);
  }

  getById(id: string): PreferenceObservationRow | undefined {
    const row = this.db
      .prepare("SELECT * FROM preference_observations WHERE id = ?")
      .get(id) as ObservationSqlRow | undefined;
    return row ? toRow(row) : undefined;
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.min(1, Math.max(0, n));
}
