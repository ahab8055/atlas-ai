import { randomUUID } from "node:crypto";

import type { SqliteDatabase } from "../client.js";

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

export class ExecutionHistoryRepository {
  constructor(private readonly db: SqliteDatabase) {}

  record(input: ExecutionHistoryInput): ExecutionHistoryRow {
    const id = `exec_${randomUUID()}`;
    const createdAt = new Date().toISOString();
    const progressJson =
      input.progress === undefined ? null : JSON.stringify(input.progress);
    const resultJson =
      input.result === undefined ? null : JSON.stringify(input.result);

    this.db
      .prepare(
        `
        INSERT INTO execution_history (
          id, task_id, plan_id, request_id, trace_id, intent, goal,
          status, lifecycle, progress_json, result_json,
          started_at, finished_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      .prepare(
        `
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
               started_at AS startedAt,
               finished_at AS finishedAt,
               created_at AS createdAt
        FROM execution_history
        WHERE id = ?
      `,
      )
      .get(id) as unknown as ExecutionHistoryRow | undefined;
    return normalizeExecutionRow(row);
  }

  listRecent(limit = 20): ExecutionHistoryRow[] {
    const rows = this.db
      .prepare(
        `
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
               started_at AS startedAt,
               finished_at AS finishedAt,
               created_at AS createdAt
        FROM execution_history
        ORDER BY created_at DESC
        LIMIT ?
      `,
      )
      .all(limit) as unknown as ExecutionHistoryRow[];
    return rows.map((row) => normalizeExecutionRow(row)!);
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
    startedAt: row.startedAt ?? undefined,
    finishedAt: row.finishedAt ?? undefined,
  };
}
