/**
 * Pending preference suggestions for approval (ADR-0052).
 */
import { randomUUID } from "node:crypto";

import type { SqliteDatabase } from "../client.js";

export type PreferenceSuggestionStatus = "pending" | "approved" | "rejected";

export interface PreferenceSuggestionRow {
  id: string;
  userId: string;
  key: string;
  value: string;
  category: string;
  confidence: number;
  observationCount: number;
  status: PreferenceSuggestionStatus;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PreferenceSuggestionUpsertInput {
  userId?: string;
  key: string;
  value: string;
  category?: string;
  confidence: number;
  observationCount?: number;
  reason?: string | null;
}

interface SuggestionSqlRow {
  id: string;
  user_id: string;
  key: string;
  value: string;
  category: string;
  confidence: number;
  observation_count: number;
  status: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

function toRow(row: SuggestionSqlRow): PreferenceSuggestionRow {
  return {
    id: row.id,
    userId: row.user_id,
    key: row.key,
    value: row.value,
    category: row.category,
    confidence: row.confidence,
    observationCount: row.observation_count,
    status: (row.status as PreferenceSuggestionStatus) ?? "pending",
    reason: row.reason ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PreferenceSuggestionsRepository {
  constructor(private readonly db: SqliteDatabase) {}

  get(id: string): PreferenceSuggestionRow | undefined {
    const row = this.db
      .prepare("SELECT * FROM preference_suggestions WHERE id = ?")
      .get(id) as SuggestionSqlRow | undefined;
    return row ? toRow(row) : undefined;
  }

  getPendingByKey(
    key: string,
    userId = "local",
  ): PreferenceSuggestionRow | undefined {
    const row = this.db
      .prepare(
        `
        SELECT * FROM preference_suggestions
        WHERE user_id = ? AND key = ? AND status = 'pending'
        ORDER BY updated_at DESC
        LIMIT 1
      `,
      )
      .get(userId, key) as SuggestionSqlRow | undefined;
    return row ? toRow(row) : undefined;
  }

  /**
   * Upsert a pending suggestion for (user, key).
   * Replaces value/confidence if a pending row already exists.
   */
  upsertPending(
    input: PreferenceSuggestionUpsertInput,
  ): PreferenceSuggestionRow {
    const userId = input.userId ?? "local";
    const key = input.key.trim();
    const value = input.value.trim();
    if (!key || !value) {
      throw new Error("Suggestion key and value are required");
    }
    const category = input.category ?? "general";
    const confidence = clamp01(input.confidence);
    const observationCount = Math.max(1, input.observationCount ?? 1);
    const reason = input.reason ?? null;
    const now = new Date().toISOString();
    const existing = this.getPendingByKey(key, userId);

    if (existing) {
      this.db
        .prepare(
          `
          UPDATE preference_suggestions
          SET value = ?,
              category = ?,
              confidence = ?,
              observation_count = ?,
              reason = ?,
              updated_at = ?
          WHERE id = ?
        `,
        )
        .run(
          value,
          category,
          confidence,
          observationCount,
          reason,
          now,
          existing.id,
        );
      return this.get(existing.id)!;
    }

    const id = `psug_${randomUUID()}`;
    this.db
      .prepare(
        `
        INSERT INTO preference_suggestions (
          id, user_id, key, value, category, confidence,
          observation_count, status, reason, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
      `,
      )
      .run(
        id,
        userId,
        key,
        value,
        category,
        confidence,
        observationCount,
        reason,
        now,
        now,
      );
    return this.get(id)!;
  }

  setStatus(
    id: string,
    status: PreferenceSuggestionStatus,
  ): PreferenceSuggestionRow | undefined {
    const existing = this.get(id);
    if (!existing) {
      return undefined;
    }
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
        UPDATE preference_suggestions
        SET status = ?, updated_at = ?
        WHERE id = ?
      `,
      )
      .run(status, now, id);
    return this.get(id);
  }

  list(
    options: {
      userId?: string;
      status?: PreferenceSuggestionStatus;
      limit?: number;
    } = {},
  ): PreferenceSuggestionRow[] {
    const userId = options.userId ?? "local";
    const limit = Math.max(1, options.limit ?? 50);
    const params: Array<string | number> = [userId];
    let sql = "SELECT * FROM preference_suggestions WHERE user_id = ?";
    if (options.status) {
      sql += " AND status = ?";
      params.push(options.status);
    }
    sql += " ORDER BY updated_at DESC LIMIT ?";
    params.push(limit);
    const rows = this.db
      .prepare(sql)
      .all(...params) as unknown as SuggestionSqlRow[];
    return rows.map(toRow);
  }

  /**
   * True if this key/value was rejected and should not re-suggest
   * until observations are reset / a new streak starts.
   */
  wasRejected(key: string, value: string, userId = "local"): boolean {
    const row = this.db
      .prepare(
        `
        SELECT id FROM preference_suggestions
        WHERE user_id = ? AND key = ? AND value = ? AND status = 'rejected'
        LIMIT 1
      `,
      )
      .get(userId, key, value) as { id: string } | undefined;
    return Boolean(row);
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.min(1, Math.max(0, n));
}
