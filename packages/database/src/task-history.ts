import type {
  ExecutionFailureInput,
  ExecutionHistoryInput,
  ExecutionHistoryQuery,
  ExecutionHistoryRepository,
  ExecutionHistoryRow,
  TaskExecutionRow,
} from "./repositories/execution-history.js";

/** Failure entry stored for history + UI detail panes. */
export interface TaskHistoryFailure {
  stepId?: string;
  message: string;
  code?: string;
  at?: string;
}

/** Per-step row for UI expansion. */
export interface TaskHistoryStep {
  id: string;
  name: string;
  status: string;
  result?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * UI-oriented task history entry.
 * Safe to render in activity lists / detail drawers without raw JSON parsing.
 */
export interface TaskHistoryEntry {
  id: string;
  taskId: string;
  planId?: string;
  requestId?: string;
  traceId?: string;
  intent?: string;
  /** Human title (goal). */
  title: string;
  status: string;
  lifecycle?: string;
  timestamps: {
    createdAt: string;
    startedAt?: string;
    finishedAt?: string;
  };
  /** Parsed execution / response payload. */
  result?: Record<string, unknown>;
  failures: TaskHistoryFailure[];
  steps: TaskHistoryStep[];
  /** Convenience fields for list cards. */
  display: {
    headline: string;
    statusLabel: string;
    subtitle: string;
    hasFailures: boolean;
    stepCount: number;
    completedStepCount: number;
  };
}

export interface TaskHistoryQuery extends ExecutionHistoryQuery {
  /** When false, skip step hydration (faster list views). Default true. */
  includeSteps?: boolean;
}

export interface TaskHistoryQueryResult {
  items: TaskHistoryEntry[];
  total: number;
  limit: number;
  offset: number;
}

const STATUS_LABELS: Record<string, string> = {
  completed: "Completed",
  partial: "Partial",
  blocked: "Blocked",
  failed: "Failed",
  cancelled: "Cancelled",
};

/**
 * Task history tracking façade — record completed actions and query for UI / CLI.
 */
export class TaskHistoryService {
  constructor(private readonly executions: ExecutionHistoryRepository) {}

  /** Persist a finished task/run (timestamps, results, failures, steps). */
  record(input: ExecutionHistoryInput): TaskHistoryEntry {
    const row = this.executions.record(input);
    const steps = this.executions.listSteps(row.id);
    return toEntry(row, steps);
  }

  getById(id: string): TaskHistoryEntry | undefined {
    const row = this.executions.getById(id);
    if (!row) {
      return undefined;
    }
    return toEntry(row, this.executions.listSteps(id));
  }

  /**
   * Query history for review UIs.
   * Supports status / intent / time filters with pagination.
   */
  query(options: TaskHistoryQuery = {}): TaskHistoryQueryResult {
    const limit = Math.max(1, Math.min(options.limit ?? 20, 200));
    const offset = Math.max(0, options.offset ?? 0);
    const includeSteps = options.includeSteps !== false;
    const { items, total } = this.executions.query({
      ...options,
      limit,
      offset,
    });

    return {
      items: items.map((row) =>
        toEntry(row, includeSteps ? this.executions.listSteps(row.id) : []),
      ),
      total,
      limit,
      offset,
    };
  }

  /** Recent completed-or-any tasks (newest first). */
  listRecent(limit = 20): TaskHistoryEntry[] {
    return this.query({ limit }).items;
  }
}

function toEntry(
  row: ExecutionHistoryRow,
  steps: TaskExecutionRow[],
): TaskHistoryEntry {
  const failures = parseFailures(row.failuresJson);
  const result = parseObject(row.resultJson);
  const title = row.goal?.trim() || row.intent || "Untitled task";
  const statusLabel = STATUS_LABELS[row.status] ?? row.status;
  const completedStepCount = steps.filter(
    (s) => s.status === "completed",
  ).length;

  const historySteps: TaskHistoryStep[] = steps.map((step) => ({
    id: step.id,
    name: step.step,
    status: step.status,
    result: step.result ?? undefined,
    error: step.error ?? undefined,
    startedAt: step.startedAt ?? undefined,
    completedAt: step.completedAt ?? undefined,
  }));

  // Surface step-level errors when no structured failures were stored.
  if (failures.length === 0) {
    for (const step of historySteps) {
      if (step.error) {
        failures.push({
          stepId: step.name,
          message: step.error,
        });
      }
    }
  }

  const when = row.finishedAt ?? row.startedAt ?? row.createdAt;
  const subtitleParts = [
    row.intent ? `intent: ${row.intent}` : undefined,
    when ? `at ${when}` : undefined,
  ].filter(Boolean);

  return {
    id: row.id,
    taskId: row.taskId,
    planId: row.planId,
    requestId: row.requestId,
    traceId: row.traceId,
    intent: row.intent,
    title,
    status: row.status,
    lifecycle: row.lifecycle,
    timestamps: {
      createdAt: row.createdAt,
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
    },
    result,
    failures,
    steps: historySteps,
    display: {
      headline: title,
      statusLabel,
      subtitle: subtitleParts.join(" · "),
      hasFailures: failures.length > 0,
      stepCount: historySteps.length,
      completedStepCount,
    },
  };
}

function parseObject(
  raw: string | undefined,
): Record<string, unknown> | undefined {
  if (!raw) {
    return undefined;
  }
  try {
    const value = JSON.parse(raw) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function parseFailures(raw: string | undefined): TaskHistoryFailure[] {
  if (!raw) {
    return [];
  }
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .filter((item): item is ExecutionFailureInput => {
        return (
          !!item &&
          typeof item === "object" &&
          typeof (item as ExecutionFailureInput).message === "string"
        );
      })
      .map((item) => ({
        stepId: item.stepId,
        message: item.message,
        code: item.code,
        at: item.at,
      }));
  } catch {
    return [];
  }
}
