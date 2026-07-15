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

function executeToolStep(
  request: NormalizedRequest,
  step: ExecutionPlan["steps"][number],
): StepResult {
  if (step.tool === "system.info") {
    return {
      stepId: step.id,
      status: "completed",
      output: `Atlas core OK (source=${request.source})`,
    };
  }

  if (step.tool === "echo") {
    return {
      stepId: step.id,
      status: "completed",
      output: String(step.args?.text ?? ""),
    };
  }

  if (step.tool === "application.open") {
    const application = String(step.args?.application ?? "unknown");
    return {
      stepId: step.id,
      status: "completed",
      output: `Application Control: would open "${application}" (launcher not wired yet).`,
    };
  }

  if (step.tool === "file.search") {
    const query = String(step.args?.query ?? "");
    return {
      stepId: step.id,
      status: "completed",
      output: `File Search: would search for "${query}" (search tool not wired yet).`,
    };
  }

  if (step.tool === "code.analyze") {
    const target = String(step.args?.target ?? "");
    return {
      stepId: step.id,
      status: "completed",
      output: `Code Analysis: would explain "${target}" (analyzer not wired yet).`,
    };
  }

  if (step.tool === "project.open") {
    const project = String(step.args?.project ?? "project");
    const path = step.args?.path ? ` at ${String(step.args.path)}` : "";
    return {
      stepId: step.id,
      status: "completed",
      output: `Project: would open "${project}"${path} (project tool not wired yet).`,
    };
  }

  if (step.tool === "process.start") {
    const name = String(step.args?.name ?? "process");
    const command = String(step.args?.command ?? "");
    return {
      stepId: step.id,
      status: "completed",
      output: `Process: would start ${name}${command ? ` (${command})` : ""} (process tool not wired yet).`,
    };
  }

  return {
    stepId: step.id,
    status: "completed",
    output: step.description,
  };
}

/**
 * Execute plan steps in order for the tool system.
 * On hard failure/block of a required step, remaining steps are skipped.
 */
export function executePlan(
  request: NormalizedRequest,
  plan: ExecutionPlan,
): ExecutionResult {
  const ordered = [...plan.steps].sort((a, b) => a.order - b.order);
  const steps: StepResult[] = [];
  let stop = false;

  for (const step of ordered) {
    if (stop) {
      steps.push({
        stepId: step.id,
        status: "skipped",
        error: "Skipped after earlier step was blocked or failed",
      });
      continue;
    }

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
        if (!step.optional) {
          stop = true;
        }
        continue;
      }
    }

    const result = executeToolStep(request, step);
    steps.push(result);
    if (
      (result.status === "failed" || result.status === "blocked") &&
      !step.optional
    ) {
      stop = true;
    }
  }

  const blocked = steps.some((s) => s.status === "blocked");
  const failed = steps.some((s) => s.status === "failed");
  const completed = steps.filter((s) => s.status === "completed").length;

  let status: ExecutionResult["status"] = "completed";
  if (failed) {
    status = "failed";
  } else if (blocked && completed === 0) {
    status = "blocked";
  } else if (blocked || steps.some((s) => s.status === "skipped")) {
    status = "partial";
  }

  return { status, steps };
}
