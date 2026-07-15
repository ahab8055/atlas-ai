export type {
  DetectedIntent,
  IntentCategory,
  IntentDefinition,
  IntentMatchResult,
  IntentParameters,
} from "./types.js";

export { IntentRegistry, toDetectedIntent, unknownIntent } from "./registry.js";

export { BUILTIN_INTENT_DEFINITIONS } from "./builtins.js";

export {
  detectIntent,
  getDefaultIntentRegistry,
  registerIntent,
  type DetectIntentOptions,
} from "./detect.js";
