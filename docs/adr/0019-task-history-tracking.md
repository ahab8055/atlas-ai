# ADR-0019: Task history tracking

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Atlas AI project team

## Context

Users need to review previous Atlas actions. Database foundation (ADR-0018) already stored `execution_history` / `task_executions`, but lacked explicit failure fields, rich query filters, and a UI-oriented DTO. CLI only appended rows with no read path.

## Decision

1. Bump schema to v2: add `failures_json` and query indexes; migrate existing files via `ALTER TABLE` when needed.
2. Add `TaskHistoryService` (`db.taskHistory`) that records timestamps/results/failures/steps and returns `TaskHistoryEntry` with a `display` block for future Activity UI.
3. Extend repository `query()` with status / intent / time range / pagination.
4. Expose `atlas history` (and REPL) for querying without forking the request pipeline.
5. Have CLI persistence use `taskHistory.record` including `execution.failures`.

## Consequences

### Positive

- Completed and failed runs are reviewable.
- History is queryable and UI-shaped without glue parsing.
- Aligns with Architecture/20 task execution history.

### Negative / trade-offs

- Display formatting remains template-based in CLI.
- Full Architecture `tasks` table (user task planner) not introduced yet — history rides on execution records.

### Follow-ups

- Desktop Activity UI consuming `TaskHistoryEntry`.
- Optional `tasks` entity linking multi-run work.
- Pruning / retention policy for local history.
