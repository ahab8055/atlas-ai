/**
 * Inference configuration types (Architecture/09 Inference Engine).
 * Non-secret settings only — never store API keys here.
 */
import type { InferenceParams } from "../inference-params.js";

/** Full inference settings: sampling + context + streaming preference. */
export interface InferenceConfig extends InferenceParams {
  /** Context window length (tokens) for the model session. */
  contextLength: number;
  /** Prefer streaming responses when the caller supports it. */
  stream: boolean;
}

/** Partial patch for global or per-model overrides. */
export type InferenceConfigPatch = Partial<InferenceConfig>;

/** On-disk document under `{dataDir}/inference-settings.json`. */
export interface StoredInferenceSettings {
  version: 1;
  /** Optional global overrides layered on Atlas config defaults. */
  global?: InferenceConfigPatch;
  /** Per-model overrides (key = registry / provider model id). */
  models: Record<string, InferenceConfigPatch>;
  updatedAt: string;
}

export interface ResolvedInferenceConfig {
  config: InferenceConfig;
  /** Where each effective field came from (explainability). */
  sources: Partial<Record<keyof InferenceConfig, string>>;
  modelId?: string;
}

export const DEFAULT_INFERENCE_CONFIG: InferenceConfig = {
  temperature: 0.7,
  maxTokens: 256,
  topP: 0.9,
  topK: 40,
  repeatPenalty: 1.1,
  contextLength: 4096,
  stream: true,
};

/** Safe numeric bounds for persisted / config values. */
export const INFERENCE_CONFIG_BOUNDS = {
  temperature: { min: 0, max: 2 },
  maxTokens: { min: 1, max: 128_000 },
  topP: { min: 0, max: 1 },
  topK: { min: 0, max: 10_000 },
  repeatPenalty: { min: 0.1, max: 3 },
  contextLength: { min: 256, max: 131_072 },
} as const;
