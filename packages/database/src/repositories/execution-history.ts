import { randomUUID } from "node:crypto";

import type { SqliteDatabase } from "../client.js";

export interface ExecutionFailureInput {
  stepId?: string;
  message: string;
  code?: string;
  at?: string;
}

export interface ExecutionStepInput {
  step: string;
  status: string;
  result?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

/** Loose DTO so `@atlas-ai/database` does not depend on `@atlas-ai/core`. */
export interface ExecutionHistoryInput {
  taskId: string;
  planId?: string;
  requestId?: string;
  traceId?: string;
  intent?: string;
  goal?: string;
  status: string;
  lifecycle?: string;
  progress?: unknown;
  result?: unknown;
  failures?: ExecutionFailureInput[];
  startedAt?: string;
  finishedAt?: string;
  steps?: ExecutionStepInput[];
}

export interface ExecutionHistoryRow {
  id: string;
  taskId: string;
  planId?: string;
  requestId?: string;
  traceId?: string;
  intent?: string;
  goal?: string;
  status: string;
  lifecycle?: string;
  progressJson?: string;
  resultJson?: string;
  failuresJson?: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
}

export interface TaskExecutionRow {
  id: string;
  executionId: string;
  taskId?: string;
  step: string;
  status: string;
  result?: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ExecutionHistoryQuery {
  /** Exact status or list of statuses. */
  status?: string | string[];
  intent?: string;
  /** ISO lower bound on finished_at / created_at. */
  from?: string;
  /** ISO upper bound on finished_at / created_at. */
  to?: string;
  limit?: number;
  offset?: number;
}

const SELECT_HISTORY = `
  SELECT id,
         task_id AS taskId,
         plan_id AS planId,
         request_id AS requestId,
         trace_id AS traceId,
         intent,
         goal,
         status,
         lifecycle,
         progress_json AS progressJson,
         result_json AS resultJson,
         failures_json AS failuresJson,
         started_at AS startedAt,
         finished_at AS finishedAt,
         created_at AS createdAt
  FROM execution_history
`;

export class ExecutionHistoryRepository {
  constructor(private readonly db: SqliteDatabase) {}

  record(input: ExecutionHistoryInput): ExecutionHistoryRow {
    const id = `exec_${randomUUID()}`;
    const createdAt = new Date().toISOString();
    const progressJson =
      input.progress === undefined ? null : JSON.stringify(input.progress);
    const resultJson =
      input.result === undefined ? null : JSON.stringify(input.result);
    const failuresJson =
      input.failures === undefined ? null : JSON.stringify(input.failures);

    this.db
      .prepare(
        `
        INSERT INTO execution_history (
          id, task_id, plan_id, request_id, trace_id, intent, goal,
          status, lifecycle, progress_json, result_json, failures_json,
          started_at, finished_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        id,
        input.taskId,
        input.planId ?? null,
        input.requestId ?? null,
        input.traceId ?? null,
        input.intent ?? null,
        input.goal ?? null,
        input.status,
        input.lifecycle ?? null,
        progressJson,
        resultJson,
        failuresJson,
        input.startedAt ?? null,
        input.finishedAt ?? null,
        createdAt,
      );

    for (const step of input.steps ?? []) {
      this.db
        .prepare(
          `
          INSERT INTO task_executions (
            id, execution_id, task_id, step, status, result, error, started_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        )
        .run(
          `step_${randomUUID()}`,
          id,
          input.taskId,
          step.step,
          step.status,
          step.result ?? null,
          step.error ?? null,
          step.startedAt ?? null,
          step.completedAt ?? null,
        );
    }

    return this.getById(id)!;
  }

  getById(id: string): ExecutionHistoryRow | undefined {
    const row = this.db
      .prepare(`${SELECT_HISTORY} WHERE id = ?`)
      .get(id) as unknown as ExecutionHistoryRow | undefined;
    return normalizeExecutionRow(row);
  }

  listRecent(limit = 20): ExecutionHistoryRow[] {
    return this.query({ limit }).items;
  }

  query(options: ExecutionHistoryQuery = {}): {
    items: ExecutionHistoryRow[];
    total: number;
  } {
    const where: string[] = [];
    const params: Array<string | number | null> = [];

    if (options.status !== undefined) {
      const statuses = Array.isArray(options.status)
        ? options.status
        : [options.status];
      if (statuses.length === 1) {
        where.push("status = ?");
        params.push(statuses[0]!);
      } else if (statuses.length > 1) {
        where.push(`status IN (${statuses.map(() => "?").join(", ")})`);
        params.push(...statuses);
      }
    }

    if (options.intent) {
      where.push("intent = ?");
      params.push(options.intent);
    }

    if (options.from) {
      where.push("COALESCE(finished_at, created_at) >= ?");
      params.push(options.from);
    }

    if (options.to) {
      where.push("COALESCE(finished_at, created_at) <= ?");
      params.push(options.to);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const limit = Math.max(1, Math.min(options.limit ?? 20, 200));
    const offset = Math.max(0, options.offset ?? 0);

    const totalRow = this.db
      .prepare(`SELECT COUNT(*) AS count FROM execution_history ${whereSql}`)
      .get(...params) as { count: number };
    const total = Number(totalRow.count);

    const items = (
      this.db
        .prepare(
          `
          ${SELECT_HISTORY}
          ${whereSql}
          ORDER BY COALESCE(finished_at, created_at) DESC, created_at DESC
          LIMIT ? OFFSET ?
        `,
        )
        .all(...params, limit, offset) as unknown as ExecutionHistoryRow[]
    ).map((row) => normalizeExecutionRow(row)!);

    return { items, total };
  }

  listSteps(executionId: string): TaskExecutionRow[] {
    return this.db
      .prepare(
        `
        SELECT id,
               execution_id AS executionId,
               task_id AS taskId,
               step,
               status,
               result,
               error,
               started_at AS startedAt,
               completed_at AS completedAt
        FROM task_executions
        WHERE execution_id = ?
        ORDER BY rowid
      `,
      )
      .all(executionId) as unknown as TaskExecutionRow[];
  }
}

function normalizeExecutionRow(
  row: ExecutionHistoryRow | undefined,
): ExecutionHistoryRow | undefined {
  if (!row) {
    return undefined;
  }
  return {
    ...row,
    planId: row.planId ?? undefined,
    requestId: row.requestId ?? undefined,
    traceId: row.traceId ?? undefined,
    intent: row.intent ?? undefined,
    goal: row.goal ?? undefined,
    lifecycle: row.lifecycle ?? undefined,
    progressJson: row.progressJson ?? undefined,
    resultJson: row.resultJson ?? undefined,
    failuresJson: row.failuresJson ?? undefined,
    startedAt: row.startedAt ?? undefined,
    finishedAt: row.finishedAt ?? undefined,
  };
}
