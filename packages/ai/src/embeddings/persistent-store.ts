/**
 * Bridge SQLite EmbeddingsRepository → EmbeddingStore without ai→database dep.
 */
import type { EmbeddingStore } from "./store.js";
import { deserializeEmbedding, serializeEmbedding } from "./vectors.js";
import type {
  EmbeddingQuery,
  EmbeddingRecord,
  StoreEmbeddingInput,
} from "./types.js";

export interface PersistentEmbeddingRow {
  id: string;
  content: string;
  embedding: Buffer | Uint8Array;
  dimensions: number;
  modelId: string;
  provider: string;
  collection: string;
  source?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface PersistentEmbeddingsApi {
  upsert(input: {
    id?: string;
    content: string;
    embedding: Buffer;
    dimensions: number;
    modelId: string;
    provider: string;
    collection?: string;
    source?: string;
    metadata?: Record<string, unknown>;
  }): PersistentEmbeddingRow;
  get(id: string): PersistentEmbeddingRow | undefined;
  list(query?: {
    collection?: string;
    source?: string;
    modelId?: string;
    limit?: number;
  }): PersistentEmbeddingRow[];
  remove(id: string): boolean;
}

function toRecord(row: PersistentEmbeddingRow): EmbeddingRecord {
  return {
    id: row.id,
    content: row.content,
    embedding: deserializeEmbedding(row.embedding),
    dimensions: row.dimensions,
    modelId: row.modelId,
    provider: row.provider,
    collection: row.collection,
    source: row.source,
    metadata: { ...row.metadata },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createPersistentEmbeddingStore(
  api: PersistentEmbeddingsApi,
): EmbeddingStore {
  return {
    upsert(input: StoreEmbeddingInput): EmbeddingRecord {
      return toRecord(
        api.upsert({
          id: input.id,
          content: input.content,
          embedding: serializeEmbedding(input.embedding),
          dimensions: input.embedding.length,
          modelId: input.modelId,
          provider: input.provider,
          collection: input.collection,
          source: input.source,
          metadata: input.metadata,
        }),
      );
    },
    get(id: string): EmbeddingRecord | undefined {
      const row = api.get(id);
      return row ? toRecord(row) : undefined;
    },
    list(query?: EmbeddingQuery): EmbeddingRecord[] {
      return api.list(query).map(toRecord);
    },
    remove(id: string): boolean {
      return api.remove(id);
    },
  };
}
