/**
 * Deterministic offline embedding provider for CI (not a chat model).
 */
import { AiRuntimeError } from "../errors.js";
import type { EmbeddingProvider, EmbeddingProviderHealth } from "./provider.js";
import { hashTextToVector } from "./vectors.js";
import type {
  EmbedBatchInput,
  EmbedResult,
  EmbedTextInput,
  EmbeddingModelInfo,
} from "./types.js";

export interface MockEmbeddingProviderOptions {
  dimensions?: number;
  models?: EmbeddingModelInfo[];
  defaultModelId?: string;
}

const DEFAULT_DIMS = 384;

export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly id = "mock-embeddings";

  private readonly dimensions: number;
  private readonly models: EmbeddingModelInfo[];
  private readonly defaultModelId: string;
  private active?: EmbeddingModelInfo;

  constructor(options: MockEmbeddingProviderOptions = {}) {
    this.dimensions = options.dimensions ?? DEFAULT_DIMS;
    this.defaultModelId = options.defaultModelId ?? "mock-embed-384";
    this.models = options.models ?? [
      {
        id: this.defaultModelId,
        name: "Mock Embedding 384",
        dimensions: this.dimensions,
        provider: this.id,
        embedding: true,
        status: "available",
      },
      {
        id: "mock-embed-memory",
        name: "Mock Memory Embedding",
        dimensions: this.dimensions,
        provider: this.id,
        embedding: true,
        status: "available",
      },
    ];
  }

  async health(): Promise<EmbeddingProviderHealth> {
    return {
      ok: true,
      provider: this.id,
      message: "Mock embedding provider ready (offline)",
      activeModelId: this.active?.id,
      checkedAt: new Date().toISOString(),
    };
  }

  async listModels(): Promise<EmbeddingModelInfo[]> {
    return this.models.map((m) => ({ ...m }));
  }

  async load(modelId: string): Promise<EmbeddingModelInfo> {
    const model = this.models.find((m) => m.id === modelId);
    if (!model) {
      throw new AiRuntimeError(`Unknown embedding model: ${modelId}`, {
        code: "model_not_found",
        provider: this.id,
      });
    }
    this.active = { ...model, status: "loaded" };
    return { ...this.active };
  }

  async unload(): Promise<void> {
    this.active = undefined;
  }

  async embed(input: EmbedTextInput): Promise<EmbedResult> {
    const started = Date.now();
    const model = await this.requireModel(input.modelId);
    const text = input.text ?? "";
    const embedding = hashTextToVector(text, model.dimensions);
    return {
      embedding,
      dimensions: embedding.length,
      modelId: model.id,
      provider: this.id,
      durationMs: Date.now() - started,
    };
  }

  async embedBatch(input: EmbedBatchInput): Promise<EmbedResult[]> {
    const results: EmbedResult[] = [];
    for (const text of input.texts) {
      results.push(await this.embed({ text, modelId: input.modelId }));
    }
    return results;
  }

  private async requireModel(modelId?: string): Promise<EmbeddingModelInfo> {
    if (modelId) {
      return this.load(modelId);
    }
    if (this.active) {
      return this.active;
    }
    return this.load(this.defaultModelId);
  }
}
