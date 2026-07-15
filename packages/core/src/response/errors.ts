import type { ExecutionFailure, ExecutionResult } from "../execution/types.js";
import {
  formatErrorCategory,
  getDefaultErrorHandler,
  type AtlasErrorResponse,
} from "../errors/index.js";

/**
 * Turn structured execution failures into AtlasErrorResponse list + user lines.
 */
export function classifyExecutionFailures(
  failures: readonly ExecutionFailure[],
  options: { traceId?: string } = {},
): AtlasErrorResponse[] {
  const handler = getDefaultErrorHandler();
  return failures.map((failure) =>
    handler.fromExecutionFailure(failure, {
      traceId: options.traceId,
      log: false,
    }),
  );
}

/**
 * Turn structured execution failures into clear user-facing error lines.
 */
export function explainFailures(
  failures: readonly ExecutionFailure[],
  options: { traceId?: string } = {},
): string[] {
  return classifyExecutionFailures(failures, options).map((error) => {
    const parts = [
      `[${formatErrorCategory(error.category)}] ${error.userMessage}`,
    ];
    if (error.message && !error.userMessage.includes(error.message)) {
      parts.push(`Detail: ${error.message}`);
    }
    const stepId = error.context?.stepId;
    if (typeof stepId === "string" && stepId.length > 0) {
      parts.push(`(step: ${stepId})`);
    }
    return parts.join(" ");
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

/** Flatten recovery descriptions into next-step strings. */
export function recoveryNextSteps(
  errors: readonly AtlasErrorResponse[],
): string[] {
  const steps: string[] = [];
  for (const error of errors) {
    for (const action of error.recovery) {
      if (!steps.includes(action.description)) {
        steps.push(action.description);
      }
    }
  }
  return steps;
}
