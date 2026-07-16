/**
 * Local AI inference types (Architecture/09, /25).
 * Kept free of any specific engine (llama.cpp, ONNX, cloud).
 */

export type ModelFormat = "gguf" | "onnx" | "unknown";

export type ModelStatus = "available" | "loaded" | "missing" | "error";

export interface ModelInfo {
  id: string;
  name: string;
  format: ModelFormat;
  /** Absolute or repo-relative path to weights when known. */
  path?: string;
  /** Provider that owns this model entry. */
  provider: string;
  status: ModelStatus;
  /** Rough size hint (bytes) when known. */
  sizeBytes?: number;
}

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface GenerateRequest {
  messages: ChatMessage[];
  /** Override active model for this call. */
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
  stop?: string[];
  /** Correlation for logs. */
  traceId?: string;
}

export interface GenerateResult {
  text: string;
  modelId: string;
  provider: string;
  finishReason?: "stop" | "length" | "error" | "unknown";
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  durationMs: number;
}

export interface StreamChunk {
  /** Incremental text (may be empty for keepalives / final). */
  text: string;
  done: boolean;
  modelId?: string;
  finishReason?: GenerateResult["finishReason"];
}

export interface RuntimeHealth {
  ok: boolean;
  provider: string;
  /** Human-readable status. */
  message: string;
  endpoint?: string;
  activeModelId?: string;
  checkedAt: string;
}

export interface AiRuntimeOptions {
  /** Active provider id (`mock` | `llamacpp` | custom). */
  provider?: string;
  /** llama.cpp / OpenAI-compatible base URL. */
  endpoint?: string;
  /** Directory to scan for `*.gguf`. */
  modelsDir?: string;
  /** Model selected after create when provider supports it. */
  defaultModelId?: string;
  /** Default sampling parameters (llama.cpp / OpenAI-compatible). */
  inference?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    topK?: number;
    repeatPenalty?: number;
    stream?: boolean;
  };
  /** CPU (default) or GPU acceleration profile. */
  hardware?: {
    acceleration?: "cpu" | "gpu";
    threads?: number;
    gpuLayers?: number;
    contextSize?: number;
  };
  /** Persist per-model inference overrides under this directory. */
  dataDir?: string;
  /** llama.cpp process management. */
  llamaCpp?: {
    manageServer?: boolean;
    binary?: string;
    extraArgs?: string[];
  };
}
