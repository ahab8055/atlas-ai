import { randomUUID } from "node:crypto";

import type { SqliteDatabase } from "../client.js";

export interface ToolRecordInput {
  name: string;
  description: string;
  type?: string;
  version?: string;
  enabled?: boolean;
  configuration?: Record<string, unknown>;
  risk?: string;
}

export interface ToolRow {
  id: string;
  name: string;
  description: string;
  type: string;
  version: string;
  enabled: boolean;
  configuration: Record<string, unknown>;
  risk?: string;
  updatedAt: string;
}

function parseJsonObject(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export class ToolsRepository {
  constructor(private readonly db: SqliteDatabase) {}

  upsert(tool: ToolRecordInput): ToolRow {
    const now = new Date().toISOString();
    const existing = this.db
      .prepare("SELECT id FROM tools WHERE name = ?")
      .get(tool.name) as { id: string } | undefined;
    const id = existing?.id ?? `tool_${randomUUID()}`;
    const configuration = JSON.stringify(tool.configuration ?? {});

    this.db
      .prepare(
        `
        INSERT INTO tools (
          id, name, description, type, version, enabled, configuration, risk, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
          description = excluded.description,
          type = excluded.type,
          version = excluded.version,
          enabled = excluded.enabled,
          configuration = excluded.configuration,
          risk = excluded.risk,
          updated_at = excluded.updated_at
      `,
      )
      .run(
        id,
        tool.name,
        tool.description,
        tool.type ?? "system",
        tool.version ?? "1.0.0",
        tool.enabled === false ? 0 : 1,
        configuration,
        tool.risk ?? null,
        now,
      );

    return this.getByName(tool.name)!;
  }

  getByName(name: string): ToolRow | undefined {
    const row = this.db
      .prepare(
        `
        SELECT id, name, description, type, version, enabled, configuration, risk,
               updated_at AS updatedAt
        FROM tools WHERE name = ?
      `,
      )
      .get(name) as unknown as
      | {
          id: string;
          name: string;
          description: string;
          type: string;
          version: string;
          enabled: number;
          configuration: string;
          risk: string | null;
          updatedAt: string;
        }
      | undefined;

    if (!row) {
      return undefined;
    }

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      version: row.version,
      enabled: row.enabled === 1,
      configuration: parseJsonObject(row.configuration),
      risk: row.risk ?? undefined,
      updatedAt: row.updatedAt,
    };
  }

  list(): ToolRow[] {
    const rows = this.db
      .prepare(
        `
        SELECT id, name, description, type, version, enabled, configuration, risk,
               updated_at AS updatedAt
        FROM tools
        ORDER BY name
      `,
      )
      .all() as unknown as Array<{
      id: string;
      name: string;
      description: string;
      type: string;
      version: string;
      enabled: number;
      configuration: string;
      risk: string | null;
      updatedAt: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      type: row.type,
      version: row.version,
      enabled: row.enabled === 1,
      configuration: parseJsonObject(row.configuration),
      risk: row.risk ?? undefined,
      updatedAt: row.updatedAt,
    }));
  }
}
