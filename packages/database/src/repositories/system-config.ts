import { randomUUID } from "node:crypto";

import type { SqliteDatabase } from "../client.js";

export interface SystemConfigRow {
  id: string;
  key: string;
  value: string;
  updatedAt: string;
}

export class SystemConfigRepository {
  constructor(private readonly db: SqliteDatabase) {}

  get(key: string): string | undefined {
    const row = this.db
      .prepare("SELECT value FROM system_config WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row?.value;
  }

  set(key: string, value: string): SystemConfigRow {
    const now = new Date().toISOString();
    const existing = this.db
      .prepare("SELECT id FROM system_config WHERE key = ?")
      .get(key) as { id: string } | undefined;

    const id = existing?.id ?? `cfg_${randomUUID()}`;
    this.db
      .prepare(
        `
        INSERT INTO system_config (id, key, value, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `,
      )
      .run(id, key, value, now);

    return { id, key, value, updatedAt: now };
  }

  list(): SystemConfigRow[] {
    return this.db
      .prepare(
        "SELECT id, key, value, updated_at AS updatedAt FROM system_config ORDER BY key",
      )
      .all() as unknown as SystemConfigRow[];
  }
}
