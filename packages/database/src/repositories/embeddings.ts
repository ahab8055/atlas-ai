/**
 * Persistent embedding vectors for search/memory (Architecture/24).
 * Vectors stored as Float32 LE BLOBs — cosine search in app layer (MVP).
 */
import { randomUUID } from "node:crypto";

import type { SqliteDatabase } from "../client.js";

export interface EmbeddingRecordInput {
  id?: string;
  content: string;
  embedding: Buffer;
  dimensions: number;
  modelId: string;
  provider: string;
  collection?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface EmbeddingRow {
  id: string;
  content: string;
  embedding: Buffer;
  dimensions: number;
  modelId: string;
  provider: string;
  collection: string;
  source?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EmbeddingListQuery {
  collection?: string;
  source?: string;
  modelId?: string;
  limit?: number;
}

interface EmbeddingSqlRow {
  id: string;
  content: string;
  embedding: Buffer;
  dimensions: number;
  model_id: string;
  provider: string;
  collection: string;
  source: string | null;
  metadata: string | null;
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

function toRow(row: EmbeddingSqlRow): EmbeddingRow {
  return {
    id: row.id,
    content: row.content,
    embedding: Buffer.from(row.embedding),
    dimensions: row.dimensions,
    modelId: row.model_id,
    provider: row.provider,
    collection: row.collection,
    source: row.source ?? undefined,
    metadata: parseMetadata(row.metadata),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class EmbeddingsRepository {
  constructor(private readonly db: SqliteDatabase) {}

  upsert(input: EmbeddingRecordInput): EmbeddingRow {
    const now = new Date().toISOString();
    const id = input.id?.trim() || randomUUID();
    const existing = this.get(id);
    const createdAt = existing?.createdAt ?? now;
    const collection = input.collection ?? "general";
    const metadata = JSON.stringify(input.metadata ?? {});

    this.db
      .prepare(
        `INSERT INTO embeddings (
          id, content, embedding, dimensions, model_id, provider,
          collection, source, metadata, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          content = excluded.content,
          embedding = excluded.embedding,
          dimensions = excluded.dimensions,
          model_id = excluded.model_id,
          provider = excluded.provider,
          collection = excluded.collection,
          source = excluded.source,
          metadata = excluded.metadata,
          updated_at = excluded.updated_at`,
      )
      .run(
        id,
        input.content,
        input.embedding,
        input.dimensions,
        input.modelId,
        input.provider,
        collection,
        input.source ?? null,
        metadata,
        createdAt,
        now,
      );

    return this.get(id)!;
  }

  get(id: string): EmbeddingRow | undefined {
    const row = this.db
      .prepare("SELECT * FROM embeddings WHERE id = ?")
      .get(id) as EmbeddingSqlRow | undefined;
    return row ? toRow(row) : undefined;
  }

  list(query: EmbeddingListQuery = {}): EmbeddingRow[] {
    const clauses: string[] = [];
    const params: (string | number)[] = [];
    if (query.collection) {
      clauses.push("collection = ?");
      params.push(query.collection);
    }
    if (query.source) {
      clauses.push("source = ?");
      params.push(query.source);
    }
    if (query.modelId) {
      clauses.push("model_id = ?");
      params.push(query.modelId);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit =
      typeof query.limit === "number" && query.limit > 0
        ? `LIMIT ${Math.floor(query.limit)}`
        : "";
    const rows = this.db
      .prepare(
        `SELECT * FROM embeddings ${where} ORDER BY updated_at DESC ${limit}`,
      )
      .all(...params) as unknown as EmbeddingSqlRow[];
    return rows.map(toRow);
  }

  remove(id: string): boolean {
    const result = this.db
      .prepare("DELETE FROM embeddings WHERE id = ?")
      .run(id) as { changes: number };
    return result.changes > 0;
  }
}
