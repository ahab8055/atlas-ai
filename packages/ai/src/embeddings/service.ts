/**
 * Embedding Service — generate & store vectors independent of chat models.
 */
import { AiRuntimeError } from "../errors.js";
import { InMemoryEmbeddingStore } from "./memory-store.js";
import type { EmbeddingProvider } from "./provider.js";
import type { EmbeddingStore } from "./store.js";
import { cosineSimilarity } from "./vectors.js";
import type {
  EmbedBatchInput,
  EmbedResult,
  EmbedTextInput,
  EmbeddingModelInfo,
  EmbeddingQuery,
  EmbeddingRecord,
  EmbeddingVector,
  FindSimilarOptions,
  SimilarityMatch,
  StoreEmbeddingInput,
} from "./types.js";

export interface EmbeddingServiceOptions {
  provider: EmbeddingProvider;
  store?: EmbeddingStore;
  defaultModelId?: string;
}

/**
 * Facade for local embeddings + optional persistence.
 * Does not use chat InferenceProvider (Architecture/25).
 */
export class EmbeddingService {
  private provider: EmbeddingProvider;
  private readonly store: EmbeddingStore;
  private readonly defaultModelId?: string;
  private activeModel?: EmbeddingModelInfo;

  constructor(options: EmbeddingServiceOptions) {
    this.provider = options.provider;
    this.store = options.store ?? new InMemoryEmbeddingStore();
    this.defaultModelId = options.defaultModelId;
  }

  getProviderId(): string {
    return this.provider.id;
  }

  getActiveModel(): EmbeddingModelInfo | undefined {
    return this.activeModel ? { ...this.activeModel } : undefined;
  }

  getStore(): EmbeddingStore {
    return this.store;
  }

  useProvider(provider: EmbeddingProvider): void {
    this.provider = provider;
    this.activeModel = undefined;
  }

  async health() {
    return this.provider.health();
  }

  async listModels(): Promise<EmbeddingModelInfo[]> {
    return this.provider.listModels();
  }

  async loadModel(modelId?: string): Promise<EmbeddingModelInfo> {
    const id = modelId ?? this.defaultModelId;
    if (!id) {
      throw new AiRuntimeError(
        "No embedding model id provided and no default configured",
        { code: "model_id_required", provider: this.provider.id },
      );
    }
    this.activeModel = await this.provider.load(id);
    return { ...this.activeModel };
  }

  async unloadModel(): Promise<void> {
    await this.provider.unload();
    this.activeModel = undefined;
  }

  /** Generate an embedding vector locally (does not persist). */
  async embed(input: EmbedTextInput | string): Promise<EmbedResult> {
    const req: EmbedTextInput =
      typeof input === "string" ? { text: input } : input;
    await this.ensureLoaded(req.modelId);
    return this.provider.embed({
      ...req,
      modelId: req.modelId ?? this.activeModel?.id ?? this.defaultModelId,
    });
  }

  async embedBatch(input: EmbedBatchInput): Promise<EmbedResult[]> {
    await this.ensureLoaded(input.modelId);
    return this.provider.embedBatch({
      ...input,
      modelId: input.modelId ?? this.activeModel?.id ?? this.defaultModelId,
    });
  }

  /** Persist a precomputed embedding for search/memory consumers. */
  storeEmbedding(input: StoreEmbeddingInput): EmbeddingRecord {
    return this.store.upsert(input);
  }

  /** Generate + persist in one step. */
  async embedAndStore(
    text: string,
    options: {
      id?: string;
      collection?: StoreEmbeddingInput["collection"];
      source?: string;
      metadata?: Record<string, unknown>;
      modelId?: string;
    } = {},
  ): Promise<EmbeddingRecord> {
    const result = await this.embed({ text, modelId: options.modelId });
    return this.store.upsert({
      id: options.id,
      content: text,
      embedding: result.embedding,
      modelId: result.modelId,
      provider: result.provider,
      collection: options.collection ?? "general",
      source: options.source,
      metadata: options.metadata,
    });
  }

  get(id: string): EmbeddingRecord | undefined {
    return this.store.get(id);
  }

  list(query?: EmbeddingQuery): EmbeddingRecord[] {
    return this.store.list(query);
  }

  remove(id: string): boolean {
    return this.store.remove(id);
  }

  /**
   * Prep for search/memory: rank stored embeddings by cosine similarity.
   * Full retrieval orchestration remains in future search/memory packages.
   */
  async findSimilar(
    query: string | EmbeddingVector,
    options: FindSimilarOptions = {},
  ): Promise<SimilarityMatch[]> {
    const vector =
      typeof query === "string"
        ? (await this.embed({ text: query, modelId: options.modelId }))
            .embedding
        : query;

    const candidates = this.store.list({
      collection: options.collection,
      modelId: options.modelId,
    });
    const minScore = options.minScore ?? 0;
    const limit =
      typeof options.limit === "number" && options.limit > 0
        ? Math.floor(options.limit)
        : 10;

    return candidates
      .map((record) => ({
        record,
        score: cosineSimilarity(vector, record.embedding),
      }))
      .filter((m) => m.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private async ensureLoaded(modelId?: string): Promise<void> {
    if (modelId) {
      this.activeModel = await this.provider.load(modelId);
      return;
    }
    if (this.activeModel) {
      return;
    }
    if (this.defaultModelId) {
      this.activeModel = await this.provider.load(this.defaultModelId);
      return;
    }
    const models = await this.provider.listModels();
    if (models[0]) {
      this.activeModel = await this.provider.load(models[0].id);
    }
  }
}

export function createEmbeddingService(
  options: EmbeddingServiceOptions,
): EmbeddingService {
  return new EmbeddingService(options);
}
