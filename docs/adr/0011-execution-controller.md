# ADR-0011: Execution controller

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Atlas AI project team

## Context

Plans are structured and tool-ready, but execution was a one-shot loop without a monitorable lifecycle. The user story requires central control with states Pending / Running / Completed / Failed / Cancelled, progress tracking, and reported failures. Architecture/22 defines an Execution Controller that starts work, monitors progress, handles failures, and returns results.

## Decision

1. Add `ExecutionController` in `@atlas-ai/core` as the sole orchestrator of plan runs.
2. Track each run as an `ExecutionTask` with lifecycle state, progress, step results, and `failures[]`.
3. Map lifecycle + step outcomes to pipeline `status` (`completed` / `partial` / `blocked` / `failed` / `cancelled`).
4. Support cancellation of pending tasks and mid-run cancel between steps.
5. Keep `executePlan(...)` as a thin facade for the pipeline and existing callers.
6. Emit progress via `onProgress` and structured logs from the pipeline.

## Consequences

### Positive

- Central control and inspectable task history for the session.
- Failures are first-class (`permission_blocked`, `tool_failed`, `cancelled`).
- Ready for `@atlas-ai/tools` to replace stub step runners behind the same controller.

### Negative / trade-offs

- In-memory task registry is process-local (not persisted).
- Permission blocks use lifecycle `failed` while outcome may be `blocked` / `partial`.

### Follow-ups

- Persist/query execution history for desktop UI.
- Async/job queue for long-running tools.
- Wire real tool registry into step execution.
