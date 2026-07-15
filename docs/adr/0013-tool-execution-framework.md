# ADR-0013: Tool execution framework

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Atlas AI project team

## Context

The tool registry can discover tools, but Architecture/05 requires an execution path: validate input, check permission, execute, capture result, return response. Callers need structured success/failure (not thrown exceptions), timing, and clear error codes so the ExecutionController can report failures.

## Decision

1. Add `ToolExecutor` / `executeTool` in `@atlas-ai/tools` as the safe execution engine.
2. Always return a `ToolExecutionResult` (never throw for tool/handler failures).
3. Validate inputs (and outputs when `data` is present) against registered schemas.
4. Optional `checkPermissions` using `@atlas-ai/security` for direct tool use; plan runs keep gating in ExecutionController.
5. Keep an in-memory execution history for monitoring.
6. Have `@atlas-ai/core` `executeToolStep` call the executor and map results into step outcomes.

## Consequences

### Positive

- Registered tools execute through one controlled path.
- Inputs validated; failures classified (`invalid_input`, `not_found`, `handler_error`, …).
- Outputs returned to core as structured records.

### Negative / trade-offs

- Async handlers not yet first-class (sync MVP; clear `async_unsupported` error).
- Duplicate permission checks possible if both controller and executor enable checks.

### Follow-ups

- `executeAsync` with job ids for long-running tools.
- Persist execution audit log locally.
