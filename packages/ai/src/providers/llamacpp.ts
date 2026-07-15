import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import type { InferenceProvider } from "../provider.js";
import { AiRuntimeError } from "../errors.js";
import {
  requireValidGguf,
  resolveGgufPath,
  validateGgufFile,
} from "../gguf.js";
import {
  DEFAULT_CPU_HARDWARE,
  mergeHardwareProfile,
  resolveGpuLayers,
  type HardwareProfile,
} from "../hardware.js";
import {
  DEFAULT_INFERENCE_PARAMS,
  inferenceParamsToApiBody,
  mergeInferenceParams,
  type InferenceParams,
} from "../inference-params.js";
import type {
  GenerateRequest,
  GenerateResult,
  ModelInfo,
  RuntimeHealth,
  StreamChunk,
} from "../types.js";
import {
  buildLlamaServerArgs,
  LlamaServerProcess,
  parseEndpoint,
} from "./llama-server-process.js";

export interface LlamaCppProviderOptions {
  /** Base URL for llama-server (OpenAI-compatible). */
  baseUrl?: string;
  /** Directory of local GGUF files. */
  modelsDir?: string;
  /** Default sampling parameters. */
  inference?: Partial<InferenceParams>;
  /** CPU/GPU profile (default CPU, gpuLayers=0). */
  hardware?: Partial<HardwareProfile>;
  /**
   * When true, `load()` spawns `llama-server` with the resolved GGUF
   * (CPU uses `-ngl 0`). When false, expects an already-running server.
   */
  manageServer?: boolean;
  /** Binary name or path for managed mode (default `llama-server`). */
  binary?: string;
  /** Extra args passed to llama-server when managed. */
  extraArgs?: string[];
  /** Inject fetch for tests. */
  fetch?: typeof fetch;
  /** Request timeout ms for health/generate. */
  timeoutMs?: number;
  /** Inject process manager for tests. */
  serverProcess?: LlamaServerProcess;
}

/**
 * Primary local inference engine — llama.cpp via `llama-server` HTTP.
 * Follows InferenceProvider; supports GGUF load + configurable parameters.
 */
export class LlamaCppProvider implements InferenceProvider {
  readonly id = "llamacpp";

  private readonly baseUrl: string;
  private readonly modelsDir?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly manageServer: boolean;
  private readonly binary: string;
  private readonly extraArgs: string[];
  private readonly server: LlamaServerProcess;
  private inferenceDefaults: InferenceParams;
  private hardware: HardwareProfile;
  private active: ModelInfo | undefined;

  constructor(options: LlamaCppProviderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://127.0.0.1:8080").replace(
      /\/$/,
      "",
    );
    this.modelsDir = options.modelsDir;
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.manageServer = options.manageServer ?? false;
    this.binary = options.binary ?? "llama-server";
    this.extraArgs = options.extraArgs ?? [];
    this.server = options.serverProcess ?? new LlamaServerProcess();
    this.inferenceDefaults = mergeInferenceParams(
      DEFAULT_INFERENCE_PARAMS,
      options.inference,
    );
    this.hardware = mergeHardwareProfile(
      DEFAULT_CPU_HARDWARE,
      options.hardware,
    );
  }

  get endpoint(): string {
    return this.baseUrl;
  }

  getHardwareProfile(): HardwareProfile {
    return { ...this.hardware };
  }

  getInferenceDefaults(): InferenceParams {
    return mergeInferenceParams(this.inferenceDefaults);
  }

  setHardwareProfile(patch: Partial<HardwareProfile>): void {
    this.hardware = mergeHardwareProfile(this.hardware, patch);
  }

  setInferenceDefaults(patch: Partial<InferenceParams>): void {
    this.inferenceDefaults = mergeInferenceParams(
      this.inferenceDefaults,
      patch,
    );
  }

  /** CLI args that would be used for a managed load (CPU → -ngl 0). */
  buildManagedServerArgs(modelPath: string): string[] {
    const { host, port } = parseEndpoint(this.baseUrl);
    return buildLlamaServerArgs({
      binary: this.binary,
      modelPath,
      host,
      port,
      hardware: this.hardware,
      extraArgs: this.extraArgs,
    });
  }

  async health(): Promise<RuntimeHealth> {
    const checkedAt = new Date().toISOString();
    try {
      const res = await this.request("/health", { method: "GET" });
      if (!res.ok) {
        const models = await this.request("/v1/models", { method: "GET" });
        if (!models.ok) {
          return {
            ok: false,
            provider: this.id,
            message: `llama-server returned ${res.status}`,
            endpoint: this.baseUrl,
            activeModelId: this.active?.id,
            checkedAt,
          };
        }
      }
      const gpuLayers = resolveGpuLayers(this.hardware);
      return {
        ok: true,
        provider: this.id,
        message: `llama.cpp ready (${this.hardware.acceleration}, ngl=${gpuLayers})`,
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
            ? `llama.cpp unreachable: ${error.message}`
            : "llama.cpp unreachable",
        endpoint: this.baseUrl,
        activeModelId: this.active?.id,
        checkedAt,
      };
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const local = this.scanGgufModels();
    try {
      const res = await this.request("/v1/models", { method: "GET" });
      if (res.ok) {
        const body = (await res.json()) as {
          data?: Array<{ id?: string }>;
        };
        const remote = (body.data ?? [])
          .map((entry) => entry.id)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
          .map((id): ModelInfo => ({
            id,
            name: id,
            format: "gguf",
            provider: this.id,
            status: this.active?.id === id ? "loaded" : "available",
          }));
        if (remote.length > 0) {
          return mergeModels(remote, local, this.active?.id);
        }
      }
    } catch {
      // Fall through to local scan.
    }
    return local.map((model) => ({
      ...model,
      status: this.active?.id === model.id ? ("loaded" as const) : model.status,
    }));
  }

  /**
   * Load a GGUF model: validate file, optionally spawn llama-server (CPU `-ngl 0`),
   * then select it for generate/stream.
   */
  async load(modelId: string): Promise<ModelInfo> {
    const filePath = resolveGgufPath(modelId, this.modelsDir);

    if (existsSync(filePath)) {
      const validation = requireValidGguf(filePath);
      if (this.manageServer) {
        await this.startManagedServer(filePath);
      } else {
        const health = await this.health();
        if (!health.ok) {
          throw new AiRuntimeError(
            `GGUF valid at ${filePath}, but llama-server is not reachable at ${this.baseUrl}. Start the server or set ai.llamaCpp.manageServer=true.`,
            { code: "runtime_unreachable", provider: this.id },
          );
        }
      }

      const id = path.basename(filePath).replace(/\.gguf$/i, "");
      this.active = {
        id,
        name: id,
        format: "gguf",
        path: filePath,
        provider: this.id,
        status: "loaded",
        sizeBytes: validation.sizeBytes,
      };
      return { ...this.active };
    }

    // No local file — select a remote model id if the server already hosts it.
    const models = await this.listModels();
    const normalized = modelId.replace(/\.gguf$/i, "");
    const found = models.find((m) => m.id === modelId || m.id === normalized);
    if (!found) {
      throw new AiRuntimeError(
        `GGUF model not found: ${modelId} (looked for ${filePath})`,
        { code: "model_not_found", provider: this.id },
      );
    }

    const health = await this.health();
    if (!health.ok) {
      throw AiRuntimeError.unreachable(this.id, health.message);
    }

    this.active = { ...found, status: "loaded" };
    return { ...this.active };
  }

  async unload(): Promise<void> {
    this.active = undefined;
    if (this.manageServer) {
      await this.server.stop();
    }
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const started = Date.now();
    const modelId = req.modelId ?? this.active?.id;
    if (!modelId) {
      throw AiRuntimeError.modelNotLoaded(this.id);
    }

    const params = this.resolveParams(req);
    const res = await this.request("/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        messages: req.messages,
        stream: false,
        ...inferenceParamsToApiBody(params),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw AiRuntimeError.unreachable(
        this.id,
        `chat completions failed (${res.status}): ${detail || res.statusText}`,
      );
    }

    const body = (await res.json()) as {
      choices?: Array<{
        message?: { content?: string };
        finish_reason?: string;
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    const text = body.choices?.[0]?.message?.content ?? "";
    const finish = body.choices?.[0]?.finish_reason;

    return {
      text,
      modelId,
      provider: this.id,
      finishReason: mapFinishReason(finish),
      usage: {
        promptTokens: body.usage?.prompt_tokens,
        completionTokens: body.usage?.completion_tokens,
        totalTokens: body.usage?.total_tokens,
      },
      durationMs: Math.max(0, Date.now() - started),
    };
  }

  async *stream(req: GenerateRequest): AsyncIterable<StreamChunk> {
    const modelId = req.modelId ?? this.active?.id;
    if (!modelId) {
      throw AiRuntimeError.modelNotLoaded(this.id);
    }

    const params = this.resolveParams(req);
    const res = await this.request("/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        messages: req.messages,
        stream: true,
        ...inferenceParamsToApiBody(params),
      }),
    });

    if (!res.ok || !res.body) {
      const detail = await res.text().catch(() => "");
      throw AiRuntimeError.unreachable(
        this.id,
        `stream failed (${res.status}): ${detail || res.statusText}`,
      );
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finishReason: GenerateResult["finishReason"] = "unknown";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) {
          continue;
        }
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") {
          yield { text: "", done: true, modelId, finishReason };
          return;
        }
        try {
          const json = JSON.parse(payload) as {
            choices?: Array<{
              delta?: { content?: string };
              finish_reason?: string | null;
            }>;
          };
          const choice = json.choices?.[0];
          const piece = choice?.delta?.content ?? "";
          if (choice?.finish_reason) {
            finishReason = mapFinishReason(choice.finish_reason);
          }
          if (piece) {
            yield { text: piece, done: false, modelId };
          }
        } catch {
          // ignore malformed SSE lines
        }
      }
    }

    yield { text: "", done: true, modelId, finishReason };
  }

  private resolveParams(req: GenerateRequest): InferenceParams {
    return mergeInferenceParams(this.inferenceDefaults, {
      temperature: req.temperature,
      maxTokens: req.maxTokens,
      topP: req.topP,
      topK: req.topK,
      repeatPenalty: req.repeatPenalty,
      stop: req.stop,
    });
  }

  private async startManagedServer(modelPath: string): Promise<void> {
    const { host, port } = parseEndpoint(this.baseUrl);
    await this.server.start(
      {
        binary: this.binary,
        modelPath,
        host,
        port,
        hardware: this.hardware,
        extraArgs: this.extraArgs,
      },
      async () => {
        const health = await this.health();
        return health.ok;
      },
    );
  }

  private scanGgufModels(): ModelInfo[] {
    if (!this.modelsDir) {
      return [];
    }
    try {
      const entries = readdirSync(this.modelsDir);
      return entries
        .filter((name) => name.toLowerCase().endsWith(".gguf"))
        .map((name) => {
          const full = path.join(this.modelsDir!, name);
          let sizeBytes: number | undefined;
          try {
            sizeBytes = statSync(full).size;
          } catch {
            sizeBytes = undefined;
          }
          const id = name.replace(/\.gguf$/i, "");
          const valid = validateGgufFile(full).ok;
          return {
            id,
            name: id,
            format: "gguf" as const,
            path: full,
            provider: this.id,
            status: (valid ? "available" : "error") as ModelInfo["status"],
            sizeBytes,
          };
        });
    } catch {
      return [];
    }
  }

  private async request(
    pathname: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(`${this.baseUrl}${pathname}`, {
        ...init,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

function mapFinishReason(
  value: string | null | undefined,
): GenerateResult["finishReason"] {
  if (value === "stop") {
    return "stop";
  }
  if (value === "length") {
    return "length";
  }
  if (!value) {
    return "unknown";
  }
  return "unknown";
}

function mergeModels(
  remote: ModelInfo[],
  local: ModelInfo[],
  activeId?: string,
): ModelInfo[] {
  const byId = new Map<string, ModelInfo>();
  for (const model of local) {
    byId.set(model.id, model);
  }
  for (const model of remote) {
    const existing = byId.get(model.id);
    byId.set(model.id, {
      ...existing,
      ...model,
      path: existing?.path ?? model.path,
      sizeBytes: existing?.sizeBytes ?? model.sizeBytes,
      status: activeId === model.id ? "loaded" : "available",
    });
  }
  return [...byId.values()];
}
