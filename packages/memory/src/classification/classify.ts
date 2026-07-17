/**
 * Heuristic memory classifier — deterministic, no LLM (Architecture/04).
 */
import type {
  ClassificationThresholds,
  MemoryClassificationInput,
  MemoryClassificationResult,
  MemoryDurability,
  SuggestedMemoryType,
} from "./types.js";
import { DEFAULT_CLASSIFICATION_THRESHOLDS } from "./types.js";
import { resolveAction, resolveExpiresAt } from "./policy.js";

const EXPLICIT_REMEMBER =
  /\b(remember|don'?t forget|note that|keep in mind|please remember)\b/i;
const PREFERENCE =
  /\b(prefer|preference|like|likes|love|always use|usually use|favorite|favourite)\b/i;
const PROCEDURAL =
  /\b(workflow|every (morning|day|week)|usually (do|open|start)|habit|routine|steps?:)\b/i;
const EPISODIC =
  /\b(yesterday|last (week|month|year|time)|we (fixed|did|resolved|debugged)|incident|happened|when we)\b/i;
const PROJECT =
  /\b(project|repo|repository|codebase|\.ts\b|\.tsx\b|path:|\/Users\/|\/home\/)\b/i;
const NOISE =
  /\b(hello|hi there|hey|thanks|thank you|coffee|weather|lol|haha|good (morning|night))\b/i;
const FOOD_CHITCHAT = /\b(tastes? (good|great|bad)|hungry|lunch|dinner)\b/i;

export interface ClassifyMemoryOptions {
  thresholds?: Partial<ClassificationThresholds>;
  now?: () => number;
}

/**
 * Classify candidate text for storage: importance, confidence, durability, type.
 */
export function classifyMemory(
  input: MemoryClassificationInput,
  options: ClassifyMemoryOptions = {},
): MemoryClassificationResult {
  const thresholds: ClassificationThresholds = {
    ...DEFAULT_CLASSIFICATION_THRESHOLDS,
    ...options.thresholds,
  };
  const text = input.text?.trim() ?? "";
  const reasons: string[] = [];
  let importance = 0.25;
  let confidence = 0.3;
  let suggestedType: SuggestedMemoryType = "none";
  let durability: MemoryDurability = "temporary";

  if (!text) {
    return {
      action: "discard",
      durability: "temporary",
      suggestedType: "none",
      importance: 0,
      confidence: 0,
      reasons: ["empty text"],
    };
  }

  const explicit =
    input.explicitRemember === true || EXPLICIT_REMEMBER.test(text);
  if (explicit) {
    importance = Math.max(importance, 0.92);
    confidence = Math.max(confidence, 0.88);
    durability = "permanent";
    suggestedType = "semantic";
    reasons.push("user explicitness: remember request");
  }

  if (PREFERENCE.test(text)) {
    importance = Math.max(importance, 0.78);
    confidence = Math.max(confidence, 0.75);
    durability = "permanent";
    suggestedType = "semantic";
    reasons.push("preference / lasting preference signal");
  }

  if (PROJECT.test(text)) {
    importance = Math.max(importance, 0.7);
    confidence = Math.max(confidence, 0.65);
    durability = "permanent";
    if (suggestedType === "none") {
      suggestedType = "semantic";
    }
    reasons.push("project / environment context value");
  }

  if (PROCEDURAL.test(text)) {
    importance = Math.max(importance, 0.72);
    confidence = Math.max(confidence, 0.7);
    durability = "permanent";
    suggestedType = "procedural";
    reasons.push("repeated workflow / habit signal");
  }

  if (EPISODIC.test(text)) {
    importance = Math.max(importance, 0.65);
    confidence = Math.max(confidence, 0.6);
    durability = "permanent";
    if (suggestedType === "none" || suggestedType === "semantic") {
      suggestedType = "episodic";
    }
    reasons.push("past experience / incident signal");
  }

  const frequency = clamp01(input.frequency ?? 0);
  if (frequency >= 0.5) {
    importance = Math.min(1, importance + frequency * 0.15);
    confidence = Math.min(1, confidence + frequency * 0.1);
    reasons.push(`frequency boost (${frequency.toFixed(2)})`);
  }

  if (NOISE.test(text) || FOOD_CHITCHAT.test(text)) {
    // Architecture example: "This coffee tastes good" → not stored.
    if (!explicit && suggestedType === "none") {
      importance = Math.min(importance, 0.2);
      confidence = Math.min(confidence, 0.25);
      durability = "temporary";
      reasons.push("ephemeral chatter / low context value");
    } else if (!explicit) {
      importance = Math.min(importance, 0.4);
      reasons.push("noise signal reduced importance");
    }
  }

  // Very short greetings without other signals
  if (text.length < 12 && suggestedType === "none" && !explicit) {
    importance = Math.min(importance, 0.15);
    confidence = Math.min(confidence, 0.2);
    durability = "temporary";
    reasons.push("too short / likely transient");
  }

  if (suggestedType === "none" && durability === "permanent") {
    suggestedType = "semantic";
  }

  if (reasons.length === 0) {
    reasons.push("no strong memory signals");
  }

  importance = clamp01(importance);
  confidence = clamp01(confidence);

  const action = resolveAction(
    { importance, confidence, durability, suggestedType },
    thresholds,
  );

  const expiresAt = resolveExpiresAt(
    { action, durability, importance, confidence },
    thresholds,
    options.now,
  );

  return {
    action,
    durability,
    suggestedType,
    importance,
    confidence,
    reasons,
    expiresAt,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}
