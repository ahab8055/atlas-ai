import { randomUUID } from "node:crypto";

import type {
  ExecutionPlan,
  PlanKind,
  PlanStep,
  PlanStepDraft,
} from "./types.js";

export function draftStep(
  id: string,
  description: string,
  extras: Omit<PlanStepDraft, "id" | "description"> = {},
): PlanStepDraft {
  return { id, description, ...extras };
}

export function orderSteps(drafts: readonly PlanStepDraft[]): PlanStep[] {
  return drafts.map((step, index) => ({
    ...step,
    order: index + 1,
  }));
}

export function finalizePlan(options: {
  goal: string;
  intentName: string;
  steps: readonly PlanStepDraft[];
  requiresApproval?: boolean;
  id?: string;
}): ExecutionPlan {
  const steps = orderSteps(options.steps);
  const kind: PlanKind = steps.length > 1 ? "multi" : "simple";
  const requiresApproval =
    options.requiresApproval ??
    steps.some(
      (step) =>
        step.capability !== undefined && step.capability !== "system.info",
    );

  return {
    id: options.id ?? randomUUID(),
    goal: options.goal,
    kind,
    intentName: options.intentName,
    steps,
    requiresApproval,
  };
}

/** Human-readable ordered plan for logs / CLI. */
export function formatPlanSteps(plan: ExecutionPlan): string {
  return plan.steps
    .map((step) => `${step.order}. ${step.description}`)
    .join("\n");
}
