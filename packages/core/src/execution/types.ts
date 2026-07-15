/** User-story execution lifecycle states. */
export type ExecutionLifecycleState =
  "pending" | "running" | "completed" | "failed" | "cancelled";

/** Per-step result statuses (tool-system detail). */
export type StepStatus =
  | "pending"
  | "running"
  | "completed"
  | "skipped"
  | "blocked"
  | "failed"
  | "cancelled";

/**
 * Pipeline/outcome status (compat with responses).
 * Maps from lifecycle + step outcomes.
 */
export type ExecutionStatus =
  "completed" | "partial" | "blocked" | "failed" | "cancelled";

export interface StepResult {
  stepId: string;
  status: StepStatus;
  output?: string;
  error?: string;
}

export interface ExecutionProgress {
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  blockedSteps: number;
  skippedSteps: number;
  cancelledSteps: number;
  currentStepId?: string;
  currentStepOrder?: number;
  /** 0–100 based on finished steps (completed/failed/blocked/skipped/cancelled). */
  percent: number;
}

export interface ExecutionFailure {
  stepId?: string;
  message: string;
  code: "permission_blocked" | "tool_failed" | "cancelled" | "unknown";
  at: string;
}

/** Monitored execution task managed by the controller. */
export interface ExecutionTask {
  id: string;
  planId: string;
  requestId: string;
  traceId: string;
  goal: string;
  state: ExecutionLifecycleState;
  outcome: ExecutionStatus;
  progress: ExecutionProgress;
  steps: StepResult[];
  failures: ExecutionFailure[];
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  cancelRequested: boolean;
}

export interface ExecutionResult {
  taskId: string;
  status: ExecutionStatus;
  lifecycle: ExecutionLifecycleState;
  progress: ExecutionProgress;
  steps: StepResult[];
  failures: ExecutionFailure[];
  startedAt: string;
  finishedAt: string;
}

export interface ExecuteOptions {
  /** Called after each step transition for live monitoring. */
  onProgress?: (task: ExecutionTask) => void;
  /**
   * Optional hook before each step (tests / cancellation).
   * Return `false` to request cancel.
   */
  beforeStep?: (task: ExecutionTask, stepId: string) => boolean;
}
