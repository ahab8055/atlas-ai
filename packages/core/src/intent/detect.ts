import type { NormalizedRequest } from "../types.js";
import { BUILTIN_INTENT_DEFINITIONS } from "./builtins.js";
import { IntentRegistry, toDetectedIntent, unknownIntent } from "./registry.js";
import type { DetectedIntent, IntentDefinition } from "./types.js";

const defaultRegistry = new IntentRegistry(BUILTIN_INTENT_DEFINITIONS);

export interface DetectIntentOptions {
  /** Override or extend the default registry. */
  registry?: IntentRegistry;
}

/** Shared default registry — call `registerIntent` to add intents later. */
export function getDefaultIntentRegistry(): IntentRegistry {
  return defaultRegistry;
}

/** Register an intent on the process-wide default registry. */
export function registerIntent(definition: IntentDefinition): void {
  defaultRegistry.register(definition);
}

/**
 * Detect user intent from a normalized request.
 * Output always follows `DetectedIntent` (including graceful `unknown`).
 */
export function detectIntent(
  request: NormalizedRequest,
  options: DetectIntentOptions = {},
): DetectedIntent {
  const registry = options.registry ?? defaultRegistry;
  const normalizedText = request.text.toLowerCase();
  const ranked = registry.matchBest(normalizedText, request.text);

  if (!ranked || ranked.match.confidence < 0.5) {
    return unknownIntent(request.text);
  }

  return toDetectedIntent(ranked.definition, ranked.match);
}
