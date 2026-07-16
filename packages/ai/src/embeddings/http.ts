/**
 * OpenAI-compatible local embeddings via llama-server `/v1/embeddings`.
 * Independent from chat generate/stream (Architecture/25).
 */
import { AiRuntimeError } from "../errors.js";
import type { EmbeddingProvider, EmbeddingProviderHealth } from "./provider.js";
import type {
  EmbedBatchInput,
  EmbedResult,
  EmbedTextInput,
  EmbeddingModelInfo,
  EmbeddingVector,
} from "./types.js";

export interface HttpEmbeddingProviderOptions {
  baseUrl?: string;
  /** Default embedding model id when not specified per call. */
  defaultModelId?: string;
  /** Expected dimensions when server omits them (validation hint). */
  dimensions?: number;
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** Extra models to advertise (e.g. from embeddings/ folder). */
  models?: EmbeddingModelInfo[];
}

export class HttpEmbeddingProvider implements EmbeddingProvider {
  readonly id = "llamacpp-embeddings";

  private readonly baseUrl: string;
  private readonly defaultModelId?: string;
  private readonly dimensions?: number;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly catalog: EmbeddingModelInfo[];
  private active?: EmbeddingModelInfo;

  constructor(options: HttpEmbeddingProviderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://127.0.0.1:8080").replace(
      /\/$/,
      "",
    );
    this.defaultModelId = options.defaultModelId;
    this.dimensions = options.dimensions;
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.catalog = options.models ?? [];
  }

  async health(): Promise<EmbeddingProviderHealth> {
    const checkedAt = new Date().toISOString();
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      return {
        ok: res.ok,
        provider: this.id,
        message: res.ok
          ? "llama-server embeddings endpoint reachable"
          : `health HTTP ${res.status}`,
        endpoint: this.baseUrl,
        activeModelId: this.active?.id,
        checkedAt,
      };
    } catch (error) {
      return {
        ok: false,
        provider: this.id,
        message:
          error instanceof Error
            ? `unreachable: ${error.message}`
            : "unreachable",
        endpoint: this.baseUrl,
        activeModelId: this.active?.id,
        checkedAt,
      };
    }
  }

  async listModels(): Promise<EmbeddingModelInfo[]> {
    if (this.catalog.length > 0) {
      return this.catalog.map((m) => ({ ...m }));
    }
    try {
      const res = await this.fetchImpl(`${this.baseUrl}/v1/models`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        return [];
      }
      const body = (await res.json()) as { data?: Array<{ id: string }> };
      return (body.data ?? []).map((m) => ({
        id: m.id,
        name: m.id,
        dimensions: this.dimensions ?? 0,
        provider: this.id,
        embedding: true as const,
        status: "available" as const,
      }));
    } catch {
      return [];
    }
  }

  async load(modelId: string): Promise<EmbeddingModelInfo> {
    const listed = await this.listModels();
    const found = listed.find((m) => m.id === modelId);
    this.active = found
      ? { ...found, status: "loaded" }
      : {
          id: modelId,
          name: modelId,
          dimensions: this.dimensions ?? 0,
          provider: this.id,
          embedding: true,
          status: "loaded",
        };
    return { ...this.active };
  }

  async unload(): Promise<void> {
    this.active = undefined;
  }

  async embed(input: EmbedTextInput): Promise<EmbedResult> {
    const results = await this.embedBatch({
      texts: [input.text],
      modelId: input.modelId,
    });
    return results[0]!;
  }

  async embedBatch(input: EmbedBatchInput): Promise<EmbedResult[]> {
    const started = Date.now();
    const modelId = input.modelId ?? this.active?.id ?? this.defaultModelId;
    if (!modelId) {
      throw new AiRuntimeError(
        "No embedding model id provided and no default configured",
        { code: "model_id_required", provider: this.id },
      );
    }

    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}/v1/embeddings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: modelId,
          input: input.texts.length === 1 ? input.texts[0] : input.texts,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      throw new AiRuntimeError(
        `Embedding request failed: ${error instanceof Error ? error.message : String(error)}`,
        { code: "provider_error", provider: this.id },
      );
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new AiRuntimeError(
        `embeddings failed (${res.status}): ${detail || res.statusText}`,
        { code: "provider_error", provider: this.id },
      );
    }

    const body = (await res.json()) as {
      data?: Array<{ embedding?: number[]; index?: number }>;
      model?: string;
    };
    const data = body.data ?? [];
    if (data.length === 0) {
      throw new AiRuntimeError("embeddings response missing data", {
        code: "provider_error",
        provider: this.id,
      });
    }

    const durationMs = Date.now() - started;
    const resolvedModel = body.model ?? modelId;
    return data
      .slice()
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((item) => {
        const embedding = (item.embedding ?? []) as EmbeddingVector;
        return {
          embedding,
          dimensions: embedding.length,
          modelId: resolvedModel,
          provider: this.id,
          durationMs,
        };
      });
  }
}
