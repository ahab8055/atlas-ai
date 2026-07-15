import type { InputSource } from "../sources.js";
import type {
  ExecutionLifecycleState,
  ExecutionStatus,
} from "../execution/types.js";
import type { ResponseModality } from "./types.js";

const STATUS_LABELS: Record<ExecutionStatus, string> = {
  completed: "Completed",
  partial: "Partially completed",
  blocked: "Blocked",
  failed: "Failed",
  cancelled: "Cancelled",
};

const LIFECYCLE_LABELS: Record<ExecutionLifecycleState, string> = {
  pending: "Pending",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function statusLabel(status: ExecutionStatus): string {
  return STATUS_LABELS[status];
}

export function lifecycleLabel(lifecycle: ExecutionLifecycleState): string {
  return LIFECYCLE_LABELS[lifecycle];
}

/** Prefer voice when the request came from the voice adapter. */
export function modalityForSource(source: InputSource): ResponseModality {
  if (source === "voice") {
    return "voice";
  }
  if (source === "desktop" || source === "cli") {
    return "text";
  }
  return "both";
}

export function formatProgress(parts: {
  completedSteps: number;
  totalSteps: number;
  percent: number;
}): string {
  return `${parts.completedSteps}/${parts.totalSteps} steps (${parts.percent}%)`;
}
