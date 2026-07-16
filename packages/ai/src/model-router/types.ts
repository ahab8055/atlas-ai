/**
 * Model router types (Architecture/25 Model Router).
 */
import type { ModelSizeClass } from "../hardware-detection/resource-profiles.js";
import type { DetectedHardware } from "../hardware-detection/types.js";
import type { RegisteredModel } from "../model-registry/types.js";

/** High-level task categories for routing. */
export type TaskType = "conversation" | "coding" | "reasoning" | "general";

/** Estimated task complexity (Architecture/25 Automatic Model Selection). */
export type ComplexityLevel = "simple" | "moderate" | "complex";

/** Auto picks a model; manual uses an explicit preferred model id. */
export type RoutingMode = "auto" | "manual";

export interface TaskAnalysis {
  taskType: TaskType;
  complexity: ComplexityLevel;
  /** 0–1 confidence in classification. */
  confidence: number;
  /** Short human-readable rationale. */
  summary: string;
  signals: string[];
}

export interface RoutingDecision {
  mode: RoutingMode;
  /** Selected model id (undefined when no catalog match). */
  modelId?: string;
  model?: RegisteredModel;
  task: TaskAnalysis;
  /** Target weight size class for this task. */
  preferredSizeClass: ModelSizeClass;
  hardwareProfileId: string;
  /** Explainable factors (Architecture/25). */
  reasons: string[];
  /** Alternatives considered (ids). */
  alternatives: string[];
  /** True when a usable model was chosen. */
  routed: boolean;
  hardware?: DetectedHardware;
}

export interface RouteModelInput {
  /** User / assistant messages or a single prompt string. */
  prompt?: string;
  messages?: Array<{ role: string; content: string }>;
  /** Manual override — skips auto selection. */
  preferredModelId?: string;
  mode?: RoutingMode;
  /** Catalog of registered models to choose from. */
  models: RegisteredModel[];
  hardware?: DetectedHardware;
  /** Fallback when routing cannot pick (e.g. config default). */
  fallbackModelId?: string;
  /** Skip GPU shell probes when detecting hardware. */
  skipGpuProbe?: boolean;
}
