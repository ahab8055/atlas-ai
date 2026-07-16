import type { Logger } from "@atlas-ai/logging";

import { AiRuntimeError } from "./errors.js";
import {
  assertModelCompatible,
  checkModelCompatibility,
} from "./model-compatibility/checker.js";
import type { ModelCompatibilityResult } from "./model-compatibility/types.js";
import type { ModelRequirements } from "./model-registry/types.js";
import type { InferenceProvider } from "./provider.js";
import {
  getDefaultProviderRegistry,
  InferenceProviderRegistry,
} from "./registry.js";
import { LlamaCppProvider } from "./providers/llamacpp.js";
import { MockInferenceProvider } from "./providers/mock.js";
import type {
  AiRuntimeOptions,
  GenerateRequest,
  GenerateResult,
  ModelInfo,
  RuntimeHealth,
  StreamChunk,
} from "./types.js";

/** Resolve registry / disk metadata used by the compatibility gate. */
export type ModelCompatibilityResolver = (modelId: string) =>
  | {
      requirements?: ModelRequirements;
      sizeBytes?: number;
    }
  | undefined;

export interface RuntimeCompatibilityOptions {
  /** When true (default), block load/generate if the host cannot run the model. */
  enabled?: boolean;
  modelsDir?: string;
  resolve?: ModelCompatibilityResolver;
  /** Skip GPU shell probes during checks (tests / CI). */
  skipGpuProbe?: boolean;
}

export interface AiRuntimeCreateOptions extends AiRuntimeOptions {
  registry?: InferenceProviderRegistry;
  logger?: Logger;
  /** Override provider instances (tests). */
  providers?: InferenceProvider[];
  /** Pre-run compatibility gate (Architecture/25). */
  compatibility?: RuntimeCompatibilityOptions;
}

/**
 * Facade between Atlas and pluggable inference engines.
 * Core / CLI call this — not llama.cpp directly.
 */
export class AiRuntime {
  private provider: InferenceProvider;
  private activeModel: ModelInfo | undefined;
  private readonly registry: InferenceProviderRegistry;
  private readonly logger?: Logger;
  private readonly defaultModelId?: string;
  private readonly compatibility?: RuntimeCompatibilityOptions;

  constructor(
    provider: InferenceProvider,
    options: {
      registry: InferenceProviderRegistry;
      logger?: Logger;
      defaultModelId?: string;
      compatibility?: RuntimeCompatibilityOptions;
    },
  ) {
    this.provider = provider;
    this.registry = options.registry;
    this.logger = options.logger;
    this.defaultModelId = options.defaultModelId;
    this.compatibility = options.compatibility;
  }

  getProviderId(): string {
    return this.provider.id;
  }

  getActiveModel(): ModelInfo | undefined {
    return this.activeModel ? { ...this.activeModel } : undefined;
  }

  listProviders(): string[] {
    return this.registry.ids();
  }

  useProvider(providerId: string): void {
    this.provider = this.registry.require(providerId);
    this.activeModel = undefined;
  }

  async health(): Promise<RuntimeHealth> {
    return this.provider.health();
  }

  async listModels(): Promise<ModelInfo[]> {
    return this.provider.listModels();
  }

  /**
   * Check host compatibility for a model without loading it.
   */
  checkCompatibility(modelId?: string): ModelCompatibilityResult {
    const id = modelId ?? this.defaultModelId;
    if (!id) {
      throw new AiRuntimeError(
        "No model id provided and no default configured",
        { code: "model_id_required", provider: this.provider.id },
      );
    }
    const meta = this.compatibility?.resolve?.(id);
    return checkModelCompatibility({
      modelId: id,
      requirements: meta?.requirements,
      sizeBytes: meta?.sizeBytes,
      modelsDir: this.compatibility?.modelsDir,
      mode: "runtime",
      skipGpuProbe: this.compatibility?.skipGpuProbe,
    });
  }

  async loadModel(modelId?: string): Promise<ModelInfo> {
    const id = modelId ?? this.defaultModelId;
    if (!id) {
      throw new AiRuntimeError(
        "No model id provided and no default configured",
        {
          code: "model_id_required",
          provider: this.provider.id,
        },
      );
    }
    this.enforceCompatibility(id);
    this.activeModel = await this.provider.load(id);
    this.logger?.info("AI model loaded", {
      category: "ai",
      context: {
        provider: this.provider.id,
        modelId: this.activeModel.id,
      },
    });
    return { ...this.activeModel };
  }

  async unloadModel(): Promise<void> {
    await this.provider.unload();
    this.activeModel = undefined;
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    await this.ensureLoaded(req.modelId);
    try {
      return await this.provider.generate(req);
    } catch (error) {
      this.logger?.error("AI generate failed", {
        category: "ai",
        error,
        context: { provider: this.provider.id, modelId: req.modelId },
      });
      throw error;
    }
  }

  async *stream(req: GenerateRequest): AsyncGenerator<StreamChunk> {
    await this.ensureLoaded(req.modelId);
    yield* this.provider.stream(req);
  }

  private enforceCompatibility(modelId: string): void {
    if (!this.compatibility || this.compatibility.enabled === false) {
      return;
    }
    const meta = this.compatibility.resolve?.(modelId);
    assertModelCompatible({
      modelId,
      requirements: meta?.requirements,
      sizeBytes: meta?.sizeBytes,
      modelsDir: this.compatibility.modelsDir,
      skipGpuProbe: this.compatibility.skipGpuProbe,
      mode: "runtime",
    });
  }

  private async ensureLoaded(modelId?: string): Promise<void> {
    if (modelId) {
      this.enforceCompatibility(modelId);
      this.activeModel = await this.provider.load(modelId);
      return;
    }
    if (this.activeModel) {
      return;
    }
    if (this.defaultModelId) {
      this.enforceCompatibility(this.defaultModelId);
      this.activeModel = await this.provider.load(this.defaultModelId);
      return;
    }
    throw AiRuntimeError.modelNotLoaded(this.provider.id);
  }
}

/**
 * Build a runtime with mock + llamacpp registered.
 */
export function createAiRuntime(
  options: AiRuntimeCreateOptions = {},
): AiRuntime {
  const registry = options.registry ?? getDefaultProviderRegistry();
  const endpoint = options.endpoint ?? "http://127.0.0.1:8080";
  const modelsDir = options.modelsDir;

  const builtins: InferenceProvider[] = options.providers ?? [
    new MockInferenceProvider(),
    new LlamaCppProvider({
      baseUrl: endpoint,
      modelsDir,
      inference: options.inference,
      hardware: options.hardware,
      manageServer: options.llamaCpp?.manageServer,
      binary: options.llamaCpp?.binary,
      extraArgs: options.llamaCpp?.extraArgs,
    }),
  ];

  for (const provider of builtins) {
    registry.register(provider, { replace: true });
  }

  const providerId = options.provider ?? "mock";
  const provider = registry.require(providerId);

  const compatibility: RuntimeCompatibilityOptions | undefined =
    options.compatibility
      ? {
          enabled: options.compatibility.enabled ?? true,
          modelsDir: options.compatibility.modelsDir ?? modelsDir,
          resolve: options.compatibility.resolve,
          skipGpuProbe: options.compatibility.skipGpuProbe,
        }
      : undefined;

  return new AiRuntime(provider, {
    registry,
    logger: options.logger,
    defaultModelId: options.defaultModelId,
    compatibility,
  });
}

let defaultRuntime: AiRuntime | undefined;

export function getDefaultAiRuntime(): AiRuntime {
  defaultRuntime ??= createAiRuntime();
  return defaultRuntime;
}

export function setDefaultAiRuntime(runtime: AiRuntime): void {
  defaultRuntime = runtime;
}
