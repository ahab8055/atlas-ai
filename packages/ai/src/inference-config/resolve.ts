/**
 * Resolve effective inference config: defaults → atlas → global store → model → request.
 */
import { mergeInferenceConfig, sanitizeInferencePatch } from "./validate.js";
import {
  DEFAULT_INFERENCE_CONFIG,
  type InferenceConfig,
  type InferenceConfigPatch,
  type ResolvedInferenceConfig,
  type StoredInferenceSettings,
} from "./types.js";

export interface ResolveInferenceConfigInput {
  /** Built-in / Atlas config baseline. */
  base?: InferenceConfig;
  stored?: StoredInferenceSettings;
  modelId?: string;
  /** Per-call overrides (GenerateRequest fields). */
  request?: InferenceConfigPatch;
}

function applyLayer(
  current: InferenceConfig,
  sources: ResolvedInferenceConfig["sources"],
  patch: InferenceConfigPatch | undefined,
  sourceLabel: string,
): InferenceConfig {
  if (!patch || Object.keys(patch).length === 0) {
    return current;
  }
  const next = mergeInferenceConfig(current, patch);
  for (const key of Object.keys(patch) as (keyof InferenceConfig)[]) {
    if (patch[key] !== undefined) {
      sources[key] = sourceLabel;
    }
  }
  return next;
}

/**
 * Merge inference settings with source attribution.
 */
export function resolveInferenceConfig(
  input: ResolveInferenceConfigInput = {},
): ResolvedInferenceConfig {
  const sources: ResolvedInferenceConfig["sources"] = {};
  let config = mergeInferenceConfig(input.base ?? DEFAULT_INFERENCE_CONFIG);
  for (const key of Object.keys(config) as (keyof InferenceConfig)[]) {
    sources[key] = "defaults";
  }

  if (input.stored?.global) {
    config = applyLayer(
      config,
      sources,
      sanitizeInferencePatch(input.stored.global),
      "global",
    );
  }

  if (input.modelId && input.stored?.models[input.modelId]) {
    config = applyLayer(
      config,
      sources,
      sanitizeInferencePatch(input.stored.models[input.modelId]),
      `model:${input.modelId}`,
    );
  }

  if (input.request) {
    config = applyLayer(
      config,
      sources,
      sanitizeInferencePatch(input.request),
      "request",
    );
  }

  return {
    config,
    sources,
    modelId: input.modelId,
  };
}

export function formatInferenceConfig(
  resolved: ResolvedInferenceConfig,
): string {
  const c = resolved.config;
  const lines = [
    `Inference config${resolved.modelId ? ` (${resolved.modelId})` : " (global)"}:`,
    `  temperature: ${c.temperature}  [${resolved.sources.temperature}]`,
    `  maxTokens: ${c.maxTokens}  [${resolved.sources.maxTokens}]`,
    `  contextLength: ${c.contextLength}  [${resolved.sources.contextLength}]`,
    `  stream: ${c.stream}  [${resolved.sources.stream}]`,
    `  topP: ${c.topP}  [${resolved.sources.topP}]`,
    `  topK: ${c.topK}  [${resolved.sources.topK}]`,
    `  repeatPenalty: ${c.repeatPenalty}  [${resolved.sources.repeatPenalty}]`,
  ];
  if (c.stop && c.stop.length > 0) {
    lines.push(`  stop: ${JSON.stringify(c.stop)}  [${resolved.sources.stop}]`);
  }
  return lines.join("\n");
}
