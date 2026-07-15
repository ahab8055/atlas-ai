import {
  evaluatePermission,
  isActionBlocked,
  type PermissionCapability,
} from "@atlas-ai/security";
import { randomUUID } from "node:crypto";

import type { ExecutionPlan, PlanStep } from "../planning/types.js";
import type { NormalizedRequest } from "../types.js";
import { executeToolStep } from "./tools.js";
import type {
  ExecuteOptions,
  ExecutionFailure,
  ExecutionProgress,
  ExecutionResult,
  ExecutionStatus,
  ExecutionTask,
  StepResult,
} from "./types.js";

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

function emptyProgress(totalSteps: number): ExecutionProgress {
  return {
    totalSteps,
    completedSteps: 0,
    failedSteps: 0,
    blockedSteps: 0,
    skippedSteps: 0,
    cancelledSteps: 0,
    percent: totalSteps === 0 ? 100 : 0,
  };
}

function recomputeProgress(
  totalSteps: number,
  steps: readonly StepResult[],
  current?: Pick<PlanStep, "id" | "order">,
): ExecutionProgress {
  const progress = emptyProgress(totalSteps);
  for (const step of steps) {
    switch (step.status) {
      case "completed":
        progress.completedSteps += 1;
        break;
      case "failed":
        progress.failedSteps += 1;
        break;
      case "blocked":
        progress.blockedSteps += 1;
        break;
      case "skipped":
        progress.skippedSteps += 1;
        break;
      case "cancelled":
        progress.cancelledSteps += 1;
        break;
      default:
        break;
    }
  }
  const finished =
    progress.completedSteps +
    progress.failedSteps +
    progress.blockedSteps +
    progress.skippedSteps +
    progress.cancelledSteps;
  progress.percent =
    totalSteps === 0 ? 100 : Math.round((finished / totalSteps) * 100);
  if (current) {
    progress.currentStepId = current.id;
    progress.currentStepOrder = current.order;
  }
  return progress;
}

function deriveOutcome(
  steps: readonly StepResult[],
  lifecycle: ExecutionTask["state"],
): ExecutionStatus {
  if (lifecycle === "cancelled") {
    return "cancelled";
  }
  const blocked = steps.some((s) => s.status === "blocked");
  const failed = steps.some((s) => s.status === "failed");
  const completed = steps.filter((s) => s.status === "completed").length;
  const skipped = steps.some((s) => s.status === "skipped");

  if (failed) {
    return "failed";
  }
  if (blocked && completed === 0) {
    return "blocked";
  }
  if (blocked || skipped) {
    return "partial";
  }
  return "completed";
}

function deriveLifecycle(
  outcome: ExecutionStatus,
  cancelRequested: boolean,
): ExecutionTask["state"] {
  if (cancelRequested && outcome === "cancelled") {
    return "cancelled";
  }
  if (outcome === "cancelled") {
    return "cancelled";
  }
  if (outcome === "completed") {
    return "completed";
  }
  // blocked / partial / failed → failed automation for lifecycle reporting
  return "failed";
}

/**
 * Central execution controller — manages lifecycle, progress, and failures.
 */
export class ExecutionController {
  private readonly tasks = new Map<string, ExecutionTask>();

  /** Create a pending task without running it (monitorable). */
  createTask(request: NormalizedRequest, plan: ExecutionPlan): ExecutionTask {
    const ordered = [...plan.steps].sort((a, b) => a.order - b.order);
    const task: ExecutionTask = {
      id: randomUUID(),
      planId: plan.id,
      requestId: request.id,
      traceId: request.traceId,
      goal: plan.goal,
      state: "pending",
      outcome: "partial",
      progress: emptyProgress(ordered.length),
      steps: ordered.map((s) => ({ stepId: s.id, status: "pending" })),
      failures: [],
      createdAt: new Date().toISOString(),
      cancelRequested: false,
    };
    this.tasks.set(task.id, task);
    return task;
  }

  getTask(taskId: string): ExecutionTask | undefined {
    const task = this.tasks.get(taskId);
    return task ? cloneTask(task) : undefined;
  }

  listTasks(): ExecutionTask[] {
    return [...this.tasks.values()].map(cloneTask);
  }

  /** Request cancellation; takes effect between steps or immediately if pending. */
  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }
    if (
      task.state === "completed" ||
      task.state === "failed" ||
      task.state === "cancelled"
    ) {
      return false;
    }
    task.cancelRequested = true;
    if (task.state === "pending") {
      this.finishCancelled(task, "Cancelled before start");
    }
    return true;
  }

  /**
   * Run a plan end-to-end: pending → running → completed | failed | cancelled.
   */
  execute(
    request: NormalizedRequest,
    plan: ExecutionPlan,
    options: ExecuteOptions = {},
  ): ExecutionResult {
    const task = this.createTask(request, plan);
    return this.run(task.id, request, plan, options);
  }

  run(
    taskId: string,
    request: NormalizedRequest,
    plan: ExecutionPlan,
    options: ExecuteOptions = {},
  ): ExecutionResult {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Unknown execution task: ${taskId}`);
    }
    if (task.state === "cancelled") {
      return toResult(task);
    }
    if (task.state !== "pending") {
      throw new Error(
        `Execution task ${taskId} is not pending (state=${task.state})`,
      );
    }

    task.state = "running";
    task.startedAt = new Date().toISOString();
    task.steps = [];
    options.onProgress?.(cloneTask(task));

    const ordered = [...plan.steps].sort((a, b) => a.order - b.order);
    let stop = false;
    let cancelled = false;
    let cancelFailureRecorded = false;

    for (const step of ordered) {
      if (task.cancelRequested) {
        cancelled = true;
        stop = true;
      }

      if (
        options.beforeStep &&
        options.beforeStep(cloneTask(task), step.id) === false
      ) {
        task.cancelRequested = true;
        cancelled = true;
        stop = true;
      }

      if (stop) {
        task.steps.push({
          stepId: step.id,
          status: cancelled ? "cancelled" : "skipped",
          error: cancelled
            ? "Cancelled"
            : "Skipped after earlier step was blocked or failed",
        });
        if (cancelled && !cancelFailureRecorded) {
          this.pushFailure(task, {
            stepId: step.id,
            message: "Execution cancelled",
            code: "cancelled",
            at: new Date().toISOString(),
          });
          cancelFailureRecorded = true;
        }
        task.progress = recomputeProgress(ordered.length, task.steps);
        options.onProgress?.(cloneTask(task));
        continue;
      }

      task.progress = recomputeProgress(ordered.length, task.steps, step);
      options.onProgress?.(cloneTask(task));

      const capability = asCapability(step.capability);
      if (capability) {
        const evaluation = evaluatePermission({
          capability,
          reason: step.description,
          resource: request.id,
        });

        if (isActionBlocked(evaluation)) {
          const result: StepResult = {
            stepId: step.id,
            status: "blocked",
            error: `Permission ${evaluation.decision} for ${capability}`,
          };
          task.steps.push(result);
          this.pushFailure(task, {
            stepId: step.id,
            message: result.error ?? "Permission blocked",
            code: "permission_blocked",
            at: new Date().toISOString(),
          });
          if (!step.optional) {
            stop = true;
          }
          task.progress = recomputeProgress(ordered.length, task.steps);
          options.onProgress?.(cloneTask(task));
          continue;
        }
      }

      const result = executeToolStep(request, step);
      task.steps.push(result);

      if (result.status === "failed") {
        this.pushFailure(task, {
          stepId: step.id,
          message: result.error ?? "Tool failed",
          code: "tool_failed",
          at: new Date().toISOString(),
        });
        if (!step.optional) {
          stop = true;
        }
      } else if (result.status === "blocked" && !step.optional) {
        stop = true;
      }

      task.progress = recomputeProgress(ordered.length, task.steps);
      options.onProgress?.(cloneTask(task));
    }

    if (cancelled || task.cancelRequested) {
      task.outcome = "cancelled";
      task.state = "cancelled";
    } else {
      task.outcome = deriveOutcome(task.steps, "running");
      task.state = deriveLifecycle(task.outcome, false);
    }

    task.finishedAt = new Date().toISOString();
    task.progress = recomputeProgress(ordered.length, task.steps);
    // Clear current step on finish
    delete task.progress.currentStepId;
    delete task.progress.currentStepOrder;
    options.onProgress?.(cloneTask(task));

    return toResult(task);
  }

  private pushFailure(task: ExecutionTask, failure: ExecutionFailure): void {
    task.failures.push(failure);
  }

  private finishCancelled(task: ExecutionTask, message: string): void {
    task.state = "cancelled";
    task.outcome = "cancelled";
    task.startedAt ??= new Date().toISOString();
    task.finishedAt = new Date().toISOString();
    this.pushFailure(task, {
      message,
      code: "cancelled",
      at: task.finishedAt,
    });
    task.steps = task.steps.map((s) =>
      s.status === "pending"
        ? { ...s, status: "cancelled", error: "Cancelled before start" }
        : s,
    );
    task.progress = recomputeProgress(task.progress.totalSteps, task.steps);
  }
}

function toResult(task: ExecutionTask): ExecutionResult {
  return {
    taskId: task.id,
    status: task.outcome,
    lifecycle: task.state,
    progress: { ...task.progress },
    steps: task.steps.map((s) => ({ ...s })),
    failures: task.failures.map((f) => ({ ...f })),
    startedAt: task.startedAt ?? task.createdAt,
    finishedAt: task.finishedAt ?? new Date().toISOString(),
  };
}

function cloneTask(task: ExecutionTask): ExecutionTask {
  return {
    ...task,
    progress: { ...task.progress },
    steps: task.steps.map((s) => ({ ...s })),
    failures: task.failures.map((f) => ({ ...f })),
  };
}

let defaultController: ExecutionController | undefined;

export function getDefaultExecutionController(): ExecutionController {
  defaultController ??= new ExecutionController();
  return defaultController;
}

export function setDefaultExecutionController(
  controller: ExecutionController,
): void {
  defaultController = controller;
}
