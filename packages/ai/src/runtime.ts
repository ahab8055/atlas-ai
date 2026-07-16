import type { Logger } from "@atlas-ai/logging";

import { AiRuntimeError } from "./errors.js";
import {
  configFromAtlasDefaults,
  createInferenceConfigManager,
  type InferenceConfigManager,
  type InferenceConfigPatch,
  type ResolvedInferenceConfig,
} from "./inference-config/index.js";
import {
  assertModelCompatible,
  checkModelCompatibility,
} from "./model-compatibility/checker.js";
import type { ModelCompatibilityResult } from "./model-compatibility/types.js";
import type { ModelRequirements } from "./model-registry/types.js";
import type { RegisteredModel } from "./model-registry/types.js";
import {
  createModelRuntimeManager,
  type InferenceSession,
  type ModelRuntimeManager,
  type ModelRuntimeManagerOptions,
  type ModelRuntimeSnapshot,
} from "./model-runtime/index.js";
import { routeModel } from "./model-router/router.js";
import type { RoutingDecision } from "./model-router/types.js";
import type { InferenceProvider } from "./provider.js";
import {
  getDefaultProviderRegistry,
  InferenceProviderRegistry,
} from "./registry.js";
import { LlamaCppProvider } from "./providers/llamacpp.js";
import { MockInferenceProvider } from "./providers/mock.js";
import {
  createAiRuntimeMonitor,
  type AiRuntimeMetricEvent,
  type AiRuntimeMetrics,
  type AiRuntimeMonitor,
  type AiRuntimeMonitorOptions,
} from "./runtime-monitoring/index.js";
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

export interface RuntimeRouterOptions {
  /** When true, generate/stream without modelId will auto-route. */
  enabled?: boolean;
  /** Catalog of registered models for routing decisions. */
  listModels?: () => RegisteredModel[];
  fallbackModelId?: string;
  skipGpuProbe?: boolean;
}

export interface AiRuntimeCreateOptions extends AiRuntimeOptions {
  registry?: InferenceProviderRegistry;
  logger?: Logger;
  /** Override provider instances (tests). */
  providers?: InferenceProvider[];
  /** Pre-run compatibility gate (Architecture/25). */
  compatibility?: RuntimeCompatibilityOptions;
  /** Automatic model selection (Architecture/25 Model Router). */
  router?: RuntimeRouterOptions;
  /** Inference settings manager (per-model overrides + safe storage). */
  inferenceConfig?: InferenceConfigManager;
  /** Model load/unload / session / memory manager options. */
  modelRuntime?: ModelRuntimeManagerOptions & {
    /** Inject a pre-built manager (tests). */
    manager?: ModelRuntimeManager;
  };
  /** AI runtime metrics collector (default: in-process ring buffer). */
  monitor?: AiRuntimeMonitor;
  /** Options when creating the default monitor. */
  monitorOptions?: AiRuntimeMonitorOptions;
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
  private readonly router?: RuntimeRouterOptions;
  private readonly inferenceConfig?: InferenceConfigManager;
  private modelRuntime: ModelRuntimeManager;
  private readonly modelRuntimeOptions?: ModelRuntimeManagerOptions;
  private readonly monitor: AiRuntimeMonitor;

  constructor(
    provider: InferenceProvider,
    options: {
      registry: InferenceProviderRegistry;
      logger?: Logger;
      defaultModelId?: string;
      compatibility?: RuntimeCompatibilityOptions;
      router?: RuntimeRouterOptions;
      inferenceConfig?: InferenceConfigManager;
      modelRuntime?: ModelRuntimeManager;
      modelRuntimeOptions?: ModelRuntimeManagerOptions;
      monitor?: AiRuntimeMonitor;
    },
  ) {
    this.provider = provider;
    this.registry = options.registry;
    this.logger = options.logger;
    this.defaultModelId = options.defaultModelId;
    this.compatibility = options.compatibility;
    this.router = options.router;
    this.inferenceConfig = options.inferenceConfig;
    this.modelRuntimeOptions = options.modelRuntimeOptions;
    this.monitor =
      options.monitor ??
      options.modelRuntimeOptions?.monitor ??
      createAiRuntimeMonitor();
    this.modelRuntime =
      options.modelRuntime ??
      createModelRuntimeManager(provider, {
        ...options.modelRuntimeOptions,
        monitor: this.monitor,
        resolveSizeBytes:
          options.modelRuntimeOptions?.resolveSizeBytes ??
          ((modelId: string) =>
            options.compatibility?.resolve?.(modelId)?.sizeBytes),
      });
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
    this.modelRuntime = createModelRuntimeManager(this.provider, {
      ...this.modelRuntimeOptions,
      monitor: this.monitor,
      resolveSizeBytes:
        this.modelRuntimeOptions?.resolveSizeBytes ??
        ((modelId: string) =>
          this.compatibility?.resolve?.(modelId)?.sizeBytes),
    });
  }

  getModelRuntime(): ModelRuntimeManager {
    return this.modelRuntime;
  }

  getRuntimeSnapshot(): ModelRuntimeSnapshot {
    return this.modelRuntime.getSnapshot();
  }

  getMonitor(): AiRuntimeMonitor {
    return this.monitor;
  }

  getMetrics(): AiRuntimeMetrics {
    this.monitor.recordStatus(this.modelRuntime.getSnapshot());
    return this.monitor.getMetrics();
  }

  getRecentMetricEvents(limit?: number): AiRuntimeMetricEvent[] {
    return this.monitor.getRecentEvents(limit);
  }

  async createInferenceSession(modelId?: string): Promise<InferenceSession> {
    const id = modelId ?? this.defaultModelId;
    if (!id) {
      throw new AiRuntimeError(
        "No model id provided and no default configured",
        { code: "model_id_required", provider: this.provider.id },
      );
    }
    this.enforceCompatibility(id);
    this.applyInferenceToProvider(id);
    const session = await this.modelRuntime.createSession(id);
    this.activeModel = this.modelRuntime
      .getSnapshot()
      .loaded.find((m) => m.modelId === id)?.model;
    return session;
  }

  endInferenceSession(sessionId: string): boolean {
    return this.modelRuntime.endSession(sessionId);
  }

  async reclaimIdleModels(): Promise<string[]> {
    const unloaded = await this.modelRuntime.reclaimIdle();
    if (this.activeModel && unloaded.includes(this.activeModel.id)) {
      this.activeModel = undefined;
    }
    return unloaded;
  }

  async health(): Promise<RuntimeHealth> {
    return this.provider.health();
  }

  async listModels(): Promise<ModelInfo[]> {
    return this.provider.listModels();
  }

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

  /**
   * Select a model for a task (explainable routing). Manual preferredModelId skips auto.
   */
  route(input: {
    prompt?: string;
    messages?: GenerateRequest["messages"];
    preferredModelId?: string;
  }): RoutingDecision {
    const catalog = this.router?.listModels?.() ?? [];
    return routeModel({
      ...input,
      models: catalog,
      preferredModelId: input.preferredModelId,
      mode: input.preferredModelId ? "manual" : "auto",
      fallbackModelId: this.router?.fallbackModelId ?? this.defaultModelId,
      skipGpuProbe: this.router?.skipGpuProbe,
    });
  }

  /** Resolve effective inference settings (global or per-model). */
  getInferenceConfig(modelId?: string): ResolvedInferenceConfig | undefined {
    if (!this.inferenceConfig) {
      return undefined;
    }
    return this.inferenceConfig.resolve(
      modelId ?? this.activeModel?.id ?? this.defaultModelId,
    );
  }

  getInferenceConfigManager(): InferenceConfigManager | undefined {
    return this.inferenceConfig;
  }

  /** Whether streaming is preferred for this model / defaults. */
  prefersStreaming(modelId?: string): boolean {
    const resolved = this.getInferenceConfig(modelId);
    return resolved?.config.stream ?? true;
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
    this.applyInferenceToProvider(id);
    try {
      this.activeModel = await this.modelRuntime.ensureLoaded(id);
      const loadMs = this.modelRuntime
        .getSnapshot()
        .loaded.find(
          (m) => m.modelId === this.activeModel?.id,
        )?.lastLoadDurationMs;
      this.logger?.info("AI model loaded", {
        category: "ai",
        context: {
          provider: this.provider.id,
          modelId: this.activeModel.id,
          durationMs: loadMs,
        },
      });
      this.monitor.recordStatus(this.modelRuntime.getSnapshot());
      return { ...this.activeModel };
    } catch (error) {
      const code = error instanceof AiRuntimeError ? error.code : undefined;
      this.logger?.error("AI model load failed", {
        category: "ai",
        error,
        context: {
          provider: this.provider.id,
          modelId: id,
          code,
        },
      });
      this.monitor.recordStatus(this.modelRuntime.getSnapshot());
      throw error;
    }
  }

  async unloadModel(modelId?: string): Promise<void> {
    await this.modelRuntime.unload(modelId);
    if (
      !modelId ||
      this.activeModel?.id === modelId ||
      !this.modelRuntime.getActiveModelId()
    ) {
      this.activeModel = undefined;
    }
    this.monitor.recordStatus(this.modelRuntime.getSnapshot());
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const modelId = await this.resolveModelId(req);
    await this.ensureLoaded(modelId);
    const id = modelId ?? this.activeModel?.id;
    const enriched = this.applyRequestInference(req, id);
    if (id) {
      this.modelRuntime.beginInference(id);
    }
    const started = Date.now();
    try {
      const result = await this.provider.generate(enriched);
      this.monitor.recordInference({
        modelId: result.modelId,
        provider: this.provider.id,
        ok: true,
        durationMs: result.durationMs,
        promptTokens: result.usage?.promptTokens,
        completionTokens: result.usage?.completionTokens,
        totalTokens: result.usage?.totalTokens,
      });
      this.logger?.info("AI generate completed", {
        category: "ai",
        context: {
          provider: this.provider.id,
          modelId: result.modelId,
          durationMs: result.durationMs,
          totalTokens: result.usage?.totalTokens,
        },
      });
      return result;
    } catch (error) {
      const durationMs = Math.max(0, Date.now() - started);
      const code = error instanceof AiRuntimeError ? error.code : undefined;
      const message = error instanceof Error ? error.message : String(error);
      this.monitor.recordInference({
        modelId: enriched.modelId ?? id,
        provider: this.provider.id,
        ok: false,
        durationMs,
        message,
      });
      this.monitor.recordError({
        operation: "generate",
        message,
        modelId: enriched.modelId ?? id,
        provider: this.provider.id,
        code,
      });
      this.logger?.error("AI generate failed", {
        category: "ai",
        error,
        context: {
          provider: this.provider.id,
          modelId: enriched.modelId,
          durationMs,
          code,
        },
      });
      throw error;
    } finally {
      if (id) {
        this.modelRuntime.endInference(id);
      }
      this.monitor.recordStatus(this.modelRuntime.getSnapshot());
    }
  }

  async *stream(req: GenerateRequest): AsyncGenerator<StreamChunk> {
    const modelId = await this.resolveModelId(req);
    await this.ensureLoaded(modelId);
    const id = modelId ?? this.activeModel?.id;
    const enriched = this.applyRequestInference(req, id);
    if (id) {
      this.modelRuntime.beginInference(id);
    }
    const started = Date.now();
    try {
      yield* this.provider.stream(enriched);
      const durationMs = Math.max(0, Date.now() - started);
      this.monitor.recordInference({
        modelId: id,
        provider: this.provider.id,
        ok: true,
        durationMs,
      });
      this.logger?.info("AI stream completed", {
        category: "ai",
        context: {
          provider: this.provider.id,
          modelId: id,
          durationMs,
        },
      });
    } catch (error) {
      const durationMs = Math.max(0, Date.now() - started);
      const code = error instanceof AiRuntimeError ? error.code : undefined;
      const message = error instanceof Error ? error.message : String(error);
      this.monitor.recordInference({
        modelId: id,
        provider: this.provider.id,
        ok: false,
        durationMs,
        message,
      });
      this.monitor.recordError({
        operation: "stream",
        message,
        modelId: id,
        provider: this.provider.id,
        code,
      });
      this.logger?.error("AI stream failed", {
        category: "ai",
        error,
        context: {
          provider: this.provider.id,
          modelId: id,
          durationMs,
          code,
        },
      });
      throw error;
    } finally {
      if (id) {
        this.modelRuntime.endInference(id);
      }
      this.monitor.recordStatus(this.modelRuntime.getSnapshot());
    }
  }

  private applyRequestInference(
    req: GenerateRequest,
    modelId?: string,
  ): GenerateRequest {
    const id = modelId ?? req.modelId;
    if (!this.inferenceConfig) {
      return { ...req, modelId: id };
    }
    const resolved = this.inferenceConfig.resolve(id, {
      temperature: req.temperature,
      maxTokens: req.maxTokens,
      topP: req.topP,
      topK: req.topK,
      repeatPenalty: req.repeatPenalty,
      stop: req.stop,
    });
    const c = resolved.config;
    return {
      ...req,
      modelId: id,
      temperature: c.temperature,
      maxTokens: c.maxTokens,
      topP: c.topP,
      topK: c.topK,
      repeatPenalty: c.repeatPenalty,
      stop: c.stop,
    };
  }

  private applyInferenceToProvider(modelId: string): void {
    if (!this.inferenceConfig) {
      return;
    }
    const { config } = this.inferenceConfig.resolve(modelId);
    const patchable = this.provider as InferenceProvider & {
      setInferenceDefaults?: (patch: InferenceConfigPatch) => void;
      setHardwareProfile?: (patch: { contextSize?: number }) => void;
    };
    patchable.setInferenceDefaults?.({
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      topP: config.topP,
      topK: config.topK,
      repeatPenalty: config.repeatPenalty,
      stop: config.stop,
    });
    patchable.setHardwareProfile?.({ contextSize: config.contextLength });
  }

  private async resolveModelId(
    req: GenerateRequest,
  ): Promise<string | undefined> {
    if (req.modelId) {
      return req.modelId;
    }
    if (
      this.router?.enabled !== false &&
      this.router?.listModels &&
      req.messages &&
      req.messages.length > 0
    ) {
      const decision = this.route({
        messages: req.messages,
      });
      if (decision.modelId) {
        this.logger?.info("AI model routed", {
          category: "ai",
          context: {
            modelId: decision.modelId,
            taskType: decision.task.taskType,
            complexity: decision.task.complexity,
            mode: decision.mode,
          },
        });
        return decision.modelId;
      }
    }
    return undefined;
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
      this.applyInferenceToProvider(modelId);
      this.activeModel = await this.modelRuntime.ensureLoaded(modelId);
      return;
    }
    if (this.activeModel) {
      return;
    }
    if (this.defaultModelId) {
      this.enforceCompatibility(this.defaultModelId);
      this.applyInferenceToProvider(this.defaultModelId);
      this.activeModel = await this.modelRuntime.ensureLoaded(
        this.defaultModelId,
      );
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

  const inferenceConfig =
    options.inferenceConfig ??
    createInferenceConfigManager({
      base: configFromAtlasDefaults({
        inference: options.inference,
        contextLength: options.hardware?.contextSize,
      }),
      dataDir: options.dataDir,
    });

  const { manager: injectedManager, ...modelRuntimeOptions } =
    options.modelRuntime ?? {};

  const monitor =
    options.monitor ?? createAiRuntimeMonitor(options.monitorOptions);

  return new AiRuntime(provider, {
    registry,
    logger: options.logger,
    defaultModelId: options.defaultModelId,
    compatibility,
    router: options.router,
    inferenceConfig,
    modelRuntime: injectedManager,
    modelRuntimeOptions: {
      ...modelRuntimeOptions,
      monitor: modelRuntimeOptions.monitor ?? monitor,
    },
    monitor,
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
