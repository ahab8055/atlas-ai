/**
 * Persistence port for embeddings (Architecture/24 Embedding Storage).
 * Implemented by memory store or SQLite (`EmbeddingsRepository`).
 */
import type {
  EmbeddingQuery,
  EmbeddingRecord,
  StoreEmbeddingInput,
} from "./types.js";

export interface EmbeddingStore {
  upsert(input: StoreEmbeddingInput): EmbeddingRecord;
  get(id: string): EmbeddingRecord | undefined;
  list(query?: EmbeddingQuery): EmbeddingRecord[];
  remove(id: string): boolean;
}
