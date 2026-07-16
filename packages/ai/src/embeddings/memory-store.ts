/**
 * In-memory embedding store for tests and offline plumbing.
 */
import { randomUUID } from "node:crypto";

import type { EmbeddingStore } from "./store.js";
import { assertValidVector } from "./vectors.js";
import type {
  EmbeddingQuery,
  EmbeddingRecord,
  StoreEmbeddingInput,
} from "./types.js";

export class InMemoryEmbeddingStore implements EmbeddingStore {
  private readonly rows = new Map<string, EmbeddingRecord>();

  upsert(input: StoreEmbeddingInput): EmbeddingRecord {
    assertValidVector(input.embedding);
    const now = new Date().toISOString();
    const id = input.id?.trim() || randomUUID();
    const existing = this.rows.get(id);
    const record: EmbeddingRecord = {
      id,
      content: input.content,
      embedding: [...input.embedding],
      dimensions: input.embedding.length,
      modelId: input.modelId,
      provider: input.provider,
      collection: input.collection ?? "general",
      source: input.source,
      metadata: { ...(input.metadata ?? {}) },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.rows.set(id, record);
    return clone(record);
  }

  get(id: string): EmbeddingRecord | undefined {
    const row = this.rows.get(id);
    return row ? clone(row) : undefined;
  }

  list(query: EmbeddingQuery = {}): EmbeddingRecord[] {
    let rows = [...this.rows.values()];
    if (query.collection) {
      rows = rows.filter((r) => r.collection === query.collection);
    }
    if (query.source) {
      rows = rows.filter((r) => r.source === query.source);
    }
    if (query.modelId) {
      rows = rows.filter((r) => r.modelId === query.modelId);
    }
    rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (typeof query.limit === "number" && query.limit > 0) {
      rows = rows.slice(0, Math.floor(query.limit));
    }
    return rows.map(clone);
  }

  remove(id: string): boolean {
    return this.rows.delete(id);
  }
}

function clone(record: EmbeddingRecord): EmbeddingRecord {
  return {
    ...record,
    embedding: [...record.embedding],
    metadata: { ...record.metadata },
  };
}
