/**
 * Persistent AI model registry (Architecture/20 models + Architecture/25 metadata).
 */
import type { SqliteDatabase } from "../client.js";

export type ModelFormat = "gguf" | "onnx" | "unknown" | string;

export type ModelStatus =
  "available" | "loaded" | "missing" | "error" | "installed" | string;

export interface ModelRequirements {
  minRamGb?: number;
  gpuLayersRecommended?: number;
  acceleration?: "cpu" | "gpu" | "any";
  notes?: string;
  [key: string]: unknown;
}

export interface ModelRecordInput {
  id: string;
  name: string;
  provider: string;
  version?: string;
  format?: ModelFormat;
  /** Size in bytes. */
  sizeBytes?: number;
  contextLength?: number;
  capabilities?: string[];
  requirements?: ModelRequirements;
  location?: string;
  status?: ModelStatus;
}

export interface ModelRow {
  id: string;
  name: string;
  provider: string;
  version?: string;
  format?: ModelFormat;
  sizeBytes?: number;
  contextLength?: number;
  capabilities: string[];
  requirements: ModelRequirements;
  location?: string;
  status: ModelStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ModelQuery {
  status?: string;
  provider?: string;
  format?: string;
  capability?: string;
  limit?: number;
}

interface ModelsSqlRow {
  id: string;
  name: string;
  provider: string;
  version: string | null;
  format: string | null;
  size: number | null;
  context_length: number | null;
  capabilities: string | null;
  requirements: string | null;
  location: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

function parseCapabilities(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function parseRequirements(raw: string | null): ModelRequirements {
  if (!raw) {
    return {};
  }
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as ModelRequirements)
      : {};
  } catch {
    return {};
  }
}

function mapRow(row: ModelsSqlRow): ModelRow {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    version: row.version ?? undefined,
    format: row.format ?? undefined,
    sizeBytes: row.size ?? undefined,
    contextLength: row.context_length ?? undefined,
    capabilities: parseCapabilities(row.capabilities),
    requirements: parseRequirements(row.requirements),
    location: row.location ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS = `
  id, name, provider, version, format, size, context_length,
  capabilities, requirements, location, status, created_at, updated_at
`;

export class ModelsRepository {
  constructor(private readonly db: SqliteDatabase) {}

  upsert(input: ModelRecordInput): ModelRow {
    const now = new Date().toISOString();
    const existing = this.get(input.id);
    const createdAt = existing?.createdAt ?? now;

    this.db
      .prepare(
        `
        INSERT INTO models (
          id, name, provider, version, format, size, context_length,
          capabilities, requirements, location, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          provider = excluded.provider,
          version = excluded.version,
          format = excluded.format,
          size = excluded.size,
          context_length = excluded.context_length,
          capabilities = excluded.capabilities,
          requirements = excluded.requirements,
          location = excluded.location,
          status = excluded.status,
          updated_at = excluded.updated_at
      `,
      )
      .run(
        input.id,
        input.name,
        input.provider,
        input.version ?? null,
        input.format ?? null,
        input.sizeBytes ?? null,
        input.contextLength ?? null,
        JSON.stringify(input.capabilities ?? []),
        JSON.stringify(input.requirements ?? {}),
        input.location ?? null,
        input.status ?? "available",
        createdAt,
        now,
      );

    return this.get(input.id)!;
  }

  get(id: string): ModelRow | undefined {
    const row = this.db
      .prepare(`SELECT ${SELECT_COLUMNS} FROM models WHERE id = ?`)
      .get(id) as ModelsSqlRow | undefined;
    return row ? mapRow(row) : undefined;
  }

  list(query: ModelQuery = {}): ModelRow[] {
    const clauses: string[] = [];
    const params: string[] = [];

    if (query.status) {
      clauses.push("status = ?");
      params.push(query.status);
    }
    if (query.provider) {
      clauses.push("provider = ?");
      params.push(query.provider);
    }
    if (query.format) {
      clauses.push("format = ?");
      params.push(query.format);
    }
    if (query.capability) {
      clauses.push("capabilities LIKE ?");
      params.push(`%${JSON.stringify(query.capability).slice(1, -1)}%`);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit =
      typeof query.limit === "number" && query.limit > 0
        ? ` LIMIT ${Math.floor(query.limit)}`
        : "";

    const rows = this.db
      .prepare(
        `SELECT ${SELECT_COLUMNS} FROM models ${where} ORDER BY name ASC${limit}`,
      )
      .all(...params) as unknown as ModelsSqlRow[];

    return rows.map(mapRow);
  }

  remove(id: string): boolean {
    const result = this.db.prepare("DELETE FROM models WHERE id = ?").run(id);
    return Number(result.changes) > 0;
  }

  count(): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS count FROM models")
      .get() as { count: number };
    return row.count;
  }
}
