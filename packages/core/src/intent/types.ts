export type IntentComplexity = "low" | "medium" | "high";

/**
 * Intent categories for routing (MVP + story examples).
 * New categories can be added without breaking existing handlers.
 */
export type IntentCategory =
  | "system"
  | "application_control"
  | "file_search"
  | "code_analysis"
  | "workflow"
  | "conversation"
  | "unknown";

/** Extracted slot values from the user utterance. */
export type IntentParameters = Record<
  string,
  string | number | boolean | undefined
>;

export interface DetectedIntent {
  /** Stable machine id, e.g. `application.open`. */
  name: string;
  /** Classification bucket for planners and tools. */
  category: IntentCategory;
  /** Short description of the user goal. */
  goal: string;
  /** Extracted parameters (application, query, target, …). */
  parameters: IntentParameters;
  confidence: number;
  capabilities: string[];
  complexity: IntentComplexity;
  /** False when no registered intent matched. */
  known: boolean;
}

/** Result of a single matcher attempt. */
export interface IntentMatchResult {
  confidence: number;
  parameters: IntentParameters;
  goal?: string;
}

/**
 * Pluggable intent definition — register new intents without changing the pipeline.
 */
export interface IntentDefinition {
  /** Stable id used in plans and responses. */
  name: string;
  category: IntentCategory;
  /** Default goal text; overridable per match. */
  goal: string;
  capabilities: string[];
  complexity: IntentComplexity;
  /** Higher priority wins on ties. */
  priority: number;
  /**
   * Attempt to match `normalizedText` (lowercased) against `originalText`.
   * Return null when this definition does not apply.
   */
  match(normalizedText: string, originalText: string): IntentMatchResult | null;
}
