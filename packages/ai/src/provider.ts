import type {
  GenerateRequest,
  GenerateResult,
  ModelInfo,
  RuntimeHealth,
  StreamChunk,
} from "./types.js";

/**
 * Pluggable inference backend (Architecture/09 / technology independence).
 * Core and CLI depend on this port — never on llama.cpp internals.
 */
export interface InferenceProvider {
  readonly id: string;

  health(): Promise<RuntimeHealth>;

  listModels(): Promise<ModelInfo[]>;

  load(modelId: string): Promise<ModelInfo>;

  unload(): Promise<void>;

  generate(req: GenerateRequest): Promise<GenerateResult>;

  stream(req: GenerateRequest): AsyncIterable<StreamChunk>;
}
