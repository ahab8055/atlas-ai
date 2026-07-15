import { randomUUID } from "node:crypto";

import type { SqliteDatabase } from "../client.js";

export interface UserPreferenceRow {
  id: string;
  userId: string;
  key: string;
  value: string;
  category: string;
  createdAt: string;
  updatedAt: string;
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

  set(
    key: string,
    value: string,
    options: { userId?: string; category?: string } = {},
  ): UserPreferenceRow {
    const userId = options.userId ?? "local";
    const category = options.category ?? "general";
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
        INSERT INTO user_preferences (id, user_id, key, value, category, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, key) DO UPDATE SET
          value = excluded.value,
          category = excluded.category,
          updated_at = excluded.updated_at
      `,
      )
      .run(id, userId, key, value, category, createdAt, now);

    return {
      id,
      userId,
      key,
      value,
      category,
      createdAt,
      updatedAt: now,
    };
  }

  list(userId = "local"): UserPreferenceRow[] {
    return this.db
      .prepare(
        `
        SELECT id,
               user_id AS userId,
               key,
               value,
               category,
               created_at AS createdAt,
               updated_at AS updatedAt
        FROM user_preferences
        WHERE user_id = ?
        ORDER BY category, key
      `,
      )
      .all(userId) as unknown as UserPreferenceRow[];
  }
}
