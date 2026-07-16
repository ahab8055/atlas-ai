/**
 * Embedding system types (Architecture/25 Embedding Model Manager,
 * Architecture/24 Embedding System).
 */

/** Float vector produced by an embedding model. */
export type EmbeddingVector = number[];

/** Collection / namespace for future search & memory consumers. */
export type EmbeddingCollection =
  "general" | "memory" | "search" | "document" | string;

export interface EmbeddingRecord {
  id: string;
  content: string;
  embedding: EmbeddingVector;
  dimensions: number;
  modelId: string;
  /** Provider that produced the vector (independent of chat). */
  provider: string;
  collection: EmbeddingCollection;
  source?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EmbedTextInput {
  text: string;
  /** Override active embedding model id. */
  modelId?: string;
}

export interface EmbedBatchInput {
  texts: string[];
  modelId?: string;
}

export interface EmbedResult {
  embedding: EmbeddingVector;
  dimensions: number;
  modelId: string;
  provider: string;
  /** Wall time for this call. */
  durationMs: number;
}

export interface StoreEmbeddingInput {
  content: string;
  embedding: EmbeddingVector;
  modelId: string;
  provider: string;
  id?: string;
  collection?: EmbeddingCollection;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface EmbeddingQuery {
  collection?: EmbeddingCollection;
  source?: string;
  modelId?: string;
  limit?: number;
}

export interface SimilarityMatch {
  record: EmbeddingRecord;
  /** Cosine similarity in [-1, 1]. */
  score: number;
}

export interface FindSimilarOptions {
  collection?: EmbeddingCollection;
  modelId?: string;
  limit?: number;
  /** Minimum cosine similarity (default 0). */
  minScore?: number;
}

export interface EmbeddingModelInfo {
  id: string;
  name: string;
  dimensions: number;
  provider: string;
  /** True when this is an embedding model (not chat). */
  embedding: true;
  status: "available" | "loaded" | "missing" | "error";
  path?: string;
}
