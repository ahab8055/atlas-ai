# ADR-0021: Phase 1 core runtime integration tests

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Atlas AI project team

## Context

Phase 1 Core Runtime spans multiple packages (`core`, `tools`, `security`, `logging`). Colocated unit tests cover modules in isolation, but regressions often appear at boundaries: pipeline stages, tool invocation after planning, permission gates, and structured error responses. The team needs automated cross-package tests so critical failures are caught before desktop/CLI work piles on.

## Decision

1. Add `tests/integration/` for cross-package Phase 1 workflows (not Playwright e2e).
2. Cover the user-story areas: request pipeline, tool execution, planning, permission checks, error handling.
3. Include a **critical path** smoke that fails with aggregated messages when any Phase 1 must-not-break flow regresses.
4. Use an isolated harness (`PermissionManager`, `ExecutionController`, `EventBus`, capturing logger) so tests do not share default process globals.
5. Expose `pnpm test:integration`; keep `pnpm test` running unit + integration via Vitest include.

## Consequences

### Positive

- Automated proof that Phase 1 components work together.
- Permission grant / approve-retry and multi-step plan execution are regression-safe.
- Critical failures surface as clear Vitest failures in CI.

### Negative / trade-offs

- Integration suite depends on built `dist/` packages (same as `pnpm test`).
- Does not replace desktop/CLI e2e (still reserved for `tests/e2e/`).

### Follow-ups

- Optional CLI adapter integration under `apps/cli` once history/persist paths grow.
- Coverage thresholds for `tests/integration` if CI wants a hard gate later.
