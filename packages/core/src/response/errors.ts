import type { ExecutionFailure, ExecutionResult } from "../execution/types.js";

const FAILURE_HINTS: Record<ExecutionFailure["code"], string> = {
  permission_blocked:
    "Atlas needs your approval before continuing this action. Review the pending permission and approve or deny it.",
  tool_failed:
    "A tool did not finish successfully. Check the detail below and try again, or run help for supported commands.",
  cancelled: "The task was cancelled before it finished.",
  unknown: "Something went wrong. Try the request again or run help.",
};

/**
 * Turn structured execution failures into clear user-facing error lines.
 */
export function explainFailures(
  failures: readonly ExecutionFailure[],
): string[] {
  if (failures.length === 0) {
    return [];
  }

  return failures.map((failure) => {
    const where = failure.stepId ? ` (step: ${failure.stepId})` : "";
    const hint = FAILURE_HINTS[failure.code];
    return `${failure.message}${where}. ${hint}`;
  });
}

/**
 * Non-fatal warnings derived from step outcomes.
 */
export function collectWarnings(execution: ExecutionResult): string[] {
  const warnings: string[] = [];
  const { progress, steps } = execution;

  if (progress.skippedSteps > 0) {
    warnings.push(
      `${progress.skippedSteps} step(s) were skipped after an earlier problem.`,
    );
  }
  if (progress.blockedSteps > 0 && execution.status === "partial") {
    warnings.push(
      `${progress.blockedSteps} step(s) were blocked by permissions; some work may still have completed.`,
    );
  }
  if (execution.status === "partial" && progress.completedSteps > 0) {
    warnings.push("The task finished only partially.");
  }

  for (const step of steps) {
    if (step.status === "failed" && step.error) {
      warnings.push(`Step ${step.stepId}: ${step.error}`);
    }
  }

  // Prefer dedicated errors[] for hard failures — avoid duplicating into warnings.
  if (execution.status === "failed") {
    return warnings.filter(
      (w) => !execution.failures.some((f) => w.includes(f.message)),
    );
  }

  return warnings;
}

export function fallbackErrorMessage(execution: ExecutionResult): string {
  return (
    execution.failures[0]?.message ??
    execution.steps.find((s) => s.error)?.error ??
    "Unknown failure"
  );
}
