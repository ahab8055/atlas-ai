import {
  evaluatePermission,
  isActionBlocked,
  type PermissionCapability,
} from "@atlas-ai/security";

import type {
  ExecutionPlan,
  ExecutionResult,
  NormalizedRequest,
  StepResult,
} from "../types.js";

const KNOWN_CAPABILITIES = new Set<PermissionCapability>([
  "system.info",
  "filesystem.read",
  "filesystem.write",
  "filesystem.delete",
  "terminal.execute",
  "browser.access",
  "application.control",
  "network.access",
  "settings.change",
  "software.install",
]);

function asCapability(value: string | undefined): PermissionCapability | null {
  if (!value) {
    return null;
  }
  return KNOWN_CAPABILITIES.has(value as PermissionCapability)
    ? (value as PermissionCapability)
    : null;
}

/**
 * Tool execution stage (stub executor).
 * Enforces security policy before any capability-bearing step.
 */
export function executePlan(
  request: NormalizedRequest,
  plan: ExecutionPlan,
): ExecutionResult {
  const steps: StepResult[] = [];

  for (const step of plan.steps) {
    const capability = asCapability(step.capability);
    if (capability) {
      const evaluation = evaluatePermission({
        capability,
        reason: step.description,
        resource: request.id,
      });

      if (isActionBlocked(evaluation)) {
        steps.push({
          stepId: step.id,
          status: "blocked",
          error: `Permission ${evaluation.decision} for ${capability}`,
        });
        continue;
      }
    }

    if (step.tool === "system.info") {
      steps.push({
        stepId: step.id,
        status: "completed",
        output: `Atlas core OK (source=${request.source})`,
      });
      continue;
    }

    if (step.tool === "echo") {
      const text = String(step.args?.text ?? "");
      steps.push({
        stepId: step.id,
        status: "completed",
        output: text,
      });
      continue;
    }

    // Non-tool steps (help / conversational) complete as informational.
    steps.push({
      stepId: step.id,
      status: "completed",
      output: step.description,
    });
  }

  const blocked = steps.some((s) => s.status === "blocked");
  const failed = steps.some((s) => s.status === "failed");
  const completed = steps.filter((s) => s.status === "completed").length;

  let status: ExecutionResult["status"] = "completed";
  if (failed) {
    status = "failed";
  } else if (blocked && completed === 0) {
    status = "blocked";
  } else if (blocked) {
    status = "partial";
  }

  return { status, steps };
}
