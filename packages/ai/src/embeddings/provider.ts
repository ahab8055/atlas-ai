/**
 * Pluggable local embedding backend — separate from chat InferenceProvider
 * (Architecture/25 Separate From Chat Models).
 */
import type {
  EmbedBatchInput,
  EmbedResult,
  EmbedTextInput,
  EmbeddingModelInfo,
} from "./types.js";

export interface EmbeddingProviderHealth {
  ok: boolean;
  provider: string;
  message: string;
  endpoint?: string;
  activeModelId?: string;
  checkedAt: string;
}

export interface EmbeddingProvider {
  readonly id: string;

  health(): Promise<EmbeddingProviderHealth>;

  listModels(): Promise<EmbeddingModelInfo[]>;

  load(modelId: string): Promise<EmbeddingModelInfo>;

  unload(): Promise<void>;

  embed(input: EmbedTextInput): Promise<EmbedResult>;

  embedBatch(input: EmbedBatchInput): Promise<EmbedResult[]>;
}
