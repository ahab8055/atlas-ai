import type { InferenceProvider } from "../provider.js";
import { AiRuntimeError } from "../errors.js";
import type {
  GenerateRequest,
  GenerateResult,
  ModelInfo,
  RuntimeHealth,
  StreamChunk,
} from "../types.js";

export interface MockInferenceProviderOptions {
  /** Extra models to advertise. */
  models?: ModelInfo[];
  /** Fixed reply prefix. */
  replyPrefix?: string;
}

/**
 * Deterministic offline provider for CI and foundation tests.
 */
export class MockInferenceProvider implements InferenceProvider {
  readonly id = "mock";
  readonly meta = {
    kind: "local" as const,
    requiresNetwork: false,
    label: "Mock (offline CI)",
    notes: "Deterministic local provider — no network",
  };

  private active: ModelInfo | undefined;
  private readonly models: ModelInfo[];
  private readonly replyPrefix: string;

  constructor(options: MockInferenceProviderOptions = {}) {
    this.replyPrefix = options.replyPrefix ?? "mock:";
    this.models = options.models ?? [
      {
        id: "mock-general",
        name: "Mock General",
        format: "gguf",
        provider: this.id,
        status: "available",
      },
      {
        id: "mock-coding",
        name: "Mock Coding",
        format: "gguf",
        provider: this.id,
        status: "available",
      },
    ];
  }

  async health(): Promise<RuntimeHealth> {
    return {
      ok: true,
      provider: this.id,
      message: "Mock inference provider ready (offline)",
      activeModelId: this.active?.id,
      checkedAt: new Date().toISOString(),
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    return this.models.map((model) => ({
      ...model,
      status: this.active?.id === model.id ? ("loaded" as const) : model.status,
    }));
  }

  async load(modelId: string): Promise<ModelInfo> {
    const model = this.models.find((m) => m.id === modelId);
    if (!model) {
      throw new AiRuntimeError(`Unknown mock model: ${modelId}`, {
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

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const started = Date.now();
    const model = await this.resolveModel(req.modelId);
    const lastUser = [...req.messages].reverse().find((m) => m.role === "user");
    const prompt = lastUser?.content ?? "";
    const text = `${this.replyPrefix} ${model.id} says: ${prompt || "(empty)"}`;

    return {
      text,
      modelId: model.id,
      provider: this.id,
      finishReason: "stop",
      usage: {
        promptTokens: prompt.length,
        completionTokens: text.length,
        totalTokens: prompt.length + text.length,
      },
      durationMs: Math.max(0, Date.now() - started),
    };
  }

  async *stream(req: GenerateRequest): AsyncIterable<StreamChunk> {
    const result = await this.generate(req);
    const parts = result.text.split(/(\s+)/).filter((p) => p.length > 0);
    for (const part of parts) {
      yield { text: part, done: false, modelId: result.modelId };
    }
    yield {
      text: "",
      done: true,
      modelId: result.modelId,
      finishReason: result.finishReason,
    };
  }

  private async resolveModel(modelId?: string): Promise<ModelInfo> {
    if (modelId) {
      return this.load(modelId);
    }
    if (!this.active) {
      throw AiRuntimeError.modelNotLoaded(this.id);
    }
    return this.active;
  }
}
