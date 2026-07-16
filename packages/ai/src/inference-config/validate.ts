/**
 * Validate and sanitize inference settings (safe storage).
 */
import type { InferenceParams } from "../inference-params.js";
import {
  DEFAULT_INFERENCE_CONFIG,
  INFERENCE_CONFIG_BOUNDS,
  type InferenceConfig,
  type InferenceConfigPatch,
  type StoredInferenceSettings,
} from "./types.js";

const ALLOWED_PATCH_KEYS = new Set<keyof InferenceConfig>([
  "temperature",
  "maxTokens",
  "topP",
  "topK",
  "repeatPenalty",
  "stop",
  "contextLength",
  "stream",
]);

/** Keys that must never appear in inference settings (secrets / credentials). */
const FORBIDDEN_KEYS = new Set([
  "apikey",
  "api_key",
  "token",
  "secret",
  "password",
  "authorization",
  "openaiapikey",
  "anthropicapikey",
  "access_token",
  "accesstoken",
  "refresh_token",
  "refreshtoken",
  "bearer",
]);

function isForbiddenKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (FORBIDDEN_KEYS.has(normalized)) {
    return true;
  }
  // Allow maxTokens / stop — reject *apiKey*, *password*, etc. as suffixes/prefixes
  return /(?:^|_)(apikey|api_key|password|secret|authorization|bearer)(?:$|_)/i.test(
    key,
  );
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function sanitizeStop(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const stops = value
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.slice(0, 64))
    .slice(0, 16);
  return stops.length > 0 ? stops : undefined;
}

/**
 * Strip forbidden keys and clamp numeric ranges. Returns a safe patch.
 */
export function sanitizeInferencePatch(input: unknown): InferenceConfigPatch {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }
  const raw = input as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (isForbiddenKey(key)) {
      throw new Error(
        `Inference settings must not include secret field "${key}"`,
      );
    }
  }

  const out: InferenceConfigPatch = {};

  const temperature = asFiniteNumber(raw.temperature);
  if (temperature !== undefined) {
    out.temperature = clamp(
      temperature,
      INFERENCE_CONFIG_BOUNDS.temperature.min,
      INFERENCE_CONFIG_BOUNDS.temperature.max,
    );
  }

  const maxTokens = asFiniteNumber(raw.maxTokens);
  if (maxTokens !== undefined) {
    out.maxTokens = Math.floor(
      clamp(
        maxTokens,
        INFERENCE_CONFIG_BOUNDS.maxTokens.min,
        INFERENCE_CONFIG_BOUNDS.maxTokens.max,
      ),
    );
  }

  const topP = asFiniteNumber(raw.topP);
  if (topP !== undefined) {
    out.topP = clamp(
      topP,
      INFERENCE_CONFIG_BOUNDS.topP.min,
      INFERENCE_CONFIG_BOUNDS.topP.max,
    );
  }

  const topK = asFiniteNumber(raw.topK);
  if (topK !== undefined) {
    out.topK = Math.floor(
      clamp(
        topK,
        INFERENCE_CONFIG_BOUNDS.topK.min,
        INFERENCE_CONFIG_BOUNDS.topK.max,
      ),
    );
  }

  const repeatPenalty = asFiniteNumber(raw.repeatPenalty);
  if (repeatPenalty !== undefined) {
    out.repeatPenalty = clamp(
      repeatPenalty,
      INFERENCE_CONFIG_BOUNDS.repeatPenalty.min,
      INFERENCE_CONFIG_BOUNDS.repeatPenalty.max,
    );
  }

  const contextLength = asFiniteNumber(raw.contextLength);
  if (contextLength !== undefined) {
    out.contextLength = Math.floor(
      clamp(
        contextLength,
        INFERENCE_CONFIG_BOUNDS.contextLength.min,
        INFERENCE_CONFIG_BOUNDS.contextLength.max,
      ),
    );
  }

  if (typeof raw.stream === "boolean") {
    out.stream = raw.stream;
  } else if (raw.stream === "true" || raw.stream === "false") {
    out.stream = raw.stream === "true";
  }

  const stop = sanitizeStop(raw.stop);
  if (stop) {
    out.stop = stop;
  }

  // Drop any non-allowed keys silently (except forbidden which throw above)
  for (const key of Object.keys(out)) {
    if (!ALLOWED_PATCH_KEYS.has(key as keyof InferenceConfig)) {
      delete (out as Record<string, unknown>)[key];
    }
  }

  return out;
}

export function mergeInferenceConfig(
  base: InferenceConfig,
  patch?: InferenceConfigPatch,
): InferenceConfig {
  if (!patch) {
    return {
      ...base,
      stop: base.stop ? [...base.stop] : undefined,
    };
  }
  return {
    temperature: patch.temperature ?? base.temperature,
    maxTokens: patch.maxTokens ?? base.maxTokens,
    topP: patch.topP ?? base.topP,
    topK: patch.topK ?? base.topK,
    repeatPenalty: patch.repeatPenalty ?? base.repeatPenalty,
    contextLength: patch.contextLength ?? base.contextLength,
    stream: patch.stream ?? base.stream,
    stop: patch.stop ?? (base.stop ? [...base.stop] : undefined),
  };
}

/** Sampling subset for OpenAI-compatible API bodies. */
export function toInferenceParams(config: InferenceConfig): InferenceParams {
  return {
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    topP: config.topP,
    topK: config.topK,
    repeatPenalty: config.repeatPenalty,
    stop: config.stop ? [...config.stop] : undefined,
  };
}

export function emptyStoredSettings(): StoredInferenceSettings {
  return {
    version: 1,
    models: {},
    updatedAt: new Date().toISOString(),
  };
}

export function sanitizeStoredSettings(
  input: unknown,
): StoredInferenceSettings {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return emptyStoredSettings();
  }
  const raw = input as Record<string, unknown>;
  const models: Record<string, InferenceConfigPatch> = {};
  if (
    raw.models &&
    typeof raw.models === "object" &&
    !Array.isArray(raw.models)
  ) {
    for (const [id, patch] of Object.entries(
      raw.models as Record<string, unknown>,
    )) {
      if (typeof id !== "string" || id.trim() === "") {
        continue;
      }
      // Reject path traversal / absolute paths as model ids in store keys
      if (id.includes("..") || id.startsWith("/") || id.includes("\0")) {
        continue;
      }
      models[id.slice(0, 256)] = sanitizeInferencePatch(patch);
    }
  }
  return {
    version: 1,
    global:
      raw.global !== undefined ? sanitizeInferencePatch(raw.global) : undefined,
    models,
    updatedAt:
      typeof raw.updatedAt === "string"
        ? raw.updatedAt
        : new Date().toISOString(),
  };
}

export function configFromAtlasDefaults(input: {
  inference?: Partial<InferenceParams> & { stream?: boolean };
  contextLength?: number;
}): InferenceConfig {
  return mergeInferenceConfig(DEFAULT_INFERENCE_CONFIG, {
    ...input.inference,
    contextLength: input.contextLength,
    stream: input.inference?.stream,
  });
}
