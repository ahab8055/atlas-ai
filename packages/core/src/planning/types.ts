import type { DetectedIntent } from "../intent/types.js";
import type { LoadedContext } from "../context/types.js";
import type { InputSource } from "../sources.js";

/** Simple = one action; multi = ordered sequence (Architecture/22). */
export type PlanKind = "simple" | "multi";

/**
 * Tool-system-ready step. Executors consume `tool` + `args` in `order`.
 */
export interface PlanStep {
  id: string;
  /** 1-based execution order. */
  order: number;
  description: string;
  /** Tool id for `@atlas-ai/tools` (stubbed in core for now). */
  tool?: string;
  args?: Record<string, unknown>;
  /** Security capability checked before the tool runs. */
  capability?: string;
  /** If true, failure/block does not stop later steps. */
  optional?: boolean;
}

export interface ExecutionPlan {
  /** Stable plan id for tracing / tool orchestration. */
  id: string;
  goal: string;
  kind: PlanKind;
  intentName: string;
  steps: PlanStep[];
  requiresApproval: boolean;
}

export interface PlanInput {
  request: {
    id: string;
    text: string;
    source: InputSource;
    sessionId: string;
  };
  intent: DetectedIntent;
  context: LoadedContext;
}

/** Skeleton step before order/ids are assigned. */
export interface PlanStepDraft {
  id: string;
  description: string;
  tool?: string;
  args?: Record<string, unknown>;
  capability?: string;
  optional?: boolean;
}

export interface PlanTemplateResult {
  goal: string;
  steps: PlanStepDraft[];
  requiresApproval: boolean;
}

/**
 * Pluggable plan template — register new multi-step workflows here.
 */
export interface PlanTemplate {
  /** Intent name this template handles (exact match). */
  intentName: string;
  priority: number;
  build(input: PlanInput): PlanTemplateResult;
}
