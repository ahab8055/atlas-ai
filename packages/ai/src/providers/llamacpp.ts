import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import type { InferenceProvider } from "../provider.js";
import { AiRuntimeError } from "../errors.js";
import type {
  GenerateRequest,
  GenerateResult,
  ModelInfo,
  RuntimeHealth,
  StreamChunk,
} from "../types.js";

export interface LlamaCppProviderOptions {
  /** Base URL for llama-server (OpenAI-compatible). */
  baseUrl?: string;
  /** Directory of local GGUF files (metadata listing). */
  modelsDir?: string;
  /** Inject fetch for tests. */
  fetch?: typeof fetch;
  /** Request timeout ms for health/generate. */
  timeoutMs?: number;
}

/**
 * Communicates with a local llama.cpp `llama-server` over HTTP.
 * Model execution stays outside Atlas core (Architecture/17).
 */
export class LlamaCppProvider implements InferenceProvider {
  readonly id = "llamacpp";

  private readonly baseUrl: string;
  private readonly modelsDir?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private active: ModelInfo | undefined;

  constructor(options: LlamaCppProviderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? "http://127.0.0.1:8080").replace(
      /\/$/,
      "",
    );
    this.modelsDir = options.modelsDir;
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  get endpoint(): string {
    return this.baseUrl;
  }

  async health(): Promise<RuntimeHealth> {
    const checkedAt = new Date().toISOString();
    try {
      const res = await this.request("/health", { method: "GET" });
      if (!res.ok) {
        // Some builds expose /v1/models instead of /health.
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
      return {
        ok: true,
        provider: this.id,
        message: "llama.cpp runtime reachable",
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

  async load(modelId: string): Promise<ModelInfo> {
    const models = await this.listModels();
    const found = models.find((m) => m.id === modelId);
    const model: ModelInfo = found ?? {
      id: modelId,
      name: modelId,
      format: "gguf",
      provider: this.id,
      status: "available",
    };
    // llama-server typically loads one model at process start; we track selection.
    this.active = { ...model, status: "loaded" };
    return { ...this.active };
  }

  async unload(): Promise<void> {
    this.active = undefined;
  }

  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const started = Date.now();
    const modelId = req.modelId ?? this.active?.id;
    if (!modelId) {
      throw AiRuntimeError.modelNotLoaded(this.id);
    }

    const res = await this.request("/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        messages: req.messages,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens ?? 256,
        stream: false,
        stop: req.stop,
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

    const res = await this.request("/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        messages: req.messages,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens ?? 256,
        stream: true,
        stop: req.stop,
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
          return {
            id,
            name: id,
            format: "gguf" as const,
            path: full,
            provider: this.id,
            status: "available" as const,
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
