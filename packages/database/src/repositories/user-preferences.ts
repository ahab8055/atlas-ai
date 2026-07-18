import { randomUUID } from "node:crypto";

import type { SqliteDatabase } from "../client.js";

export type PreferenceSource = "manual" | "learned" | "seed";

export interface UserPreferenceRow {
  id: string;
  userId: string;
  key: string;
  value: string;
  category: string;
  source: PreferenceSource;
  confidence: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferenceSetOptions {
  userId?: string;
  category?: string;
  source?: PreferenceSource;
  confidence?: number;
  enabled?: boolean;
}

export interface UserPreferenceListOptions {
  userId?: string;
  category?: string;
  enabledOnly?: boolean;
}

const SELECT_COLS = `
  id,
  user_id AS userId,
  key,
  value,
  category,
  source,
  confidence,
  enabled,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

function mapRow(raw: Record<string, unknown>): UserPreferenceRow {
  return {
    id: String(raw.id),
    userId: String(raw.userId),
    key: String(raw.key),
    value: String(raw.value),
    category: String(raw.category),
    source: (raw.source as PreferenceSource) ?? "manual",
    confidence: Number(raw.confidence ?? 1),
    enabled: Number(raw.enabled ?? 1) === 1,
    createdAt: String(raw.createdAt),
    updatedAt: String(raw.updatedAt),
  };
}

export class UserPreferencesRepository {
  constructor(private readonly db: SqliteDatabase) {}

  get(key: string, userId = "local"): string | undefined {
    const row = this.db
      .prepare(
        "SELECT value FROM user_preferences WHERE user_id = ? AND key = ?",
      )
      .get(userId, key) as { value: string } | undefined;
    return row?.value;
  }

  getRow(key: string, userId = "local"): UserPreferenceRow | undefined {
    const raw = this.db
      .prepare(
        `SELECT ${SELECT_COLS} FROM user_preferences WHERE user_id = ? AND key = ?`,
      )
      .get(userId, key) as Record<string, unknown> | undefined;
    return raw ? mapRow(raw) : undefined;
  }

  set(
    key: string,
    value: string,
    options: UserPreferenceSetOptions = {},
  ): UserPreferenceRow {
    const userId = options.userId ?? "local";
    const category = options.category ?? "general";
    const source = options.source ?? "manual";
    const confidence = clamp01(options.confidence ?? 1);
    const enabled = options.enabled !== false ? 1 : 0;
    const now = new Date().toISOString();
    const existing = this.db
      .prepare(
        "SELECT id, created_at AS createdAt FROM user_preferences WHERE user_id = ? AND key = ?",
      )
      .get(userId, key) as { id: string; createdAt: string } | undefined;

    const id = existing?.id ?? `pref_${randomUUID()}`;
    const createdAt = existing?.createdAt ?? now;

    this.db
      .prepare(
        `
        INSERT INTO user_preferences (
          id, user_id, key, value, category, source, confidence, enabled, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, key) DO UPDATE SET
          value = excluded.value,
          category = excluded.category,
          source = excluded.source,
          confidence = excluded.confidence,
          enabled = excluded.enabled,
          updated_at = excluded.updated_at
      `,
      )
      .run(
        id,
        userId,
        key,
        value,
        category,
        source,
        confidence,
        enabled,
        createdAt,
        now,
      );

    return {
      id,
      userId,
      key,
      value,
      category,
      source,
      confidence,
      enabled: enabled === 1,
      createdAt,
      updatedAt: now,
    };
  }

  list(options: UserPreferenceListOptions | string = {}): UserPreferenceRow[] {
    const opts =
      typeof options === "string" ? { userId: options } : (options ?? {});
    const userId = opts.userId ?? "local";
    const clauses = ["user_id = ?"];
    const params: string[] = [userId];

    if (opts.category) {
      clauses.push("category = ?");
      params.push(opts.category);
    }
    if (opts.enabledOnly) {
      clauses.push("enabled = 1");
    }

    const rows = this.db
      .prepare(
        `
        SELECT ${SELECT_COLS}
        FROM user_preferences
        WHERE ${clauses.join(" AND ")}
        ORDER BY category, key
      `,
      )
      .all(...params) as Array<Record<string, unknown>>;

    return rows.map(mapRow);
  }

  delete(key: string, userId = "local"): boolean {
    const result = this.db
      .prepare("DELETE FROM user_preferences WHERE user_id = ? AND key = ?")
      .run(userId, key);
    return Number(result.changes ?? 0) > 0;
  }

  setEnabled(
    key: string,
    enabled: boolean,
    userId = "local",
  ): UserPreferenceRow | undefined {
    const existing = this.getRow(key, userId);
    if (!existing) {
      return undefined;
    }
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
        UPDATE user_preferences
        SET enabled = ?, updated_at = ?
        WHERE user_id = ? AND key = ?
      `,
      )
      .run(enabled ? 1 : 0, now, userId, key);
    return { ...existing, enabled, updatedAt: now };
  }
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) {
    return 1;
  }
  return Math.min(1, Math.max(0, n));
}
