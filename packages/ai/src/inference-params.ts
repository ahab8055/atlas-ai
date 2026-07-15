/**
 * Configurable inference sampling parameters for local LLMs.
 */

export interface InferenceParams {
  temperature: number;
  maxTokens: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
  stop?: string[];
}

export const DEFAULT_INFERENCE_PARAMS: InferenceParams = {
  temperature: 0.7,
  maxTokens: 256,
  topP: 0.9,
  topK: 40,
  repeatPenalty: 1.1,
};

export function mergeInferenceParams(
  base: InferenceParams,
  patch?: Partial<InferenceParams>,
): InferenceParams {
  if (!patch) {
    return { ...base, stop: base.stop ? [...base.stop] : undefined };
  }
  return {
    temperature: patch.temperature ?? base.temperature,
    maxTokens: patch.maxTokens ?? base.maxTokens,
    topP: patch.topP ?? base.topP,
    topK: patch.topK ?? base.topK,
    repeatPenalty: patch.repeatPenalty ?? base.repeatPenalty,
    stop: patch.stop ?? (base.stop ? [...base.stop] : undefined),
  };
}

/** Build OpenAI / llama-server chat completion body fields from params. */
export function inferenceParamsToApiBody(
  params: InferenceParams,
): Record<string, unknown> {
  return {
    temperature: params.temperature,
    max_tokens: params.maxTokens,
    top_p: params.topP,
    top_k: params.topK,
    repeat_penalty: params.repeatPenalty,
    ...(params.stop && params.stop.length > 0 ? { stop: params.stop } : {}),
  };
}
