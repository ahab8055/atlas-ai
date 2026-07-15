# ADR-0020: Error handling framework

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Atlas AI project team

## Context

As the core runtime grows (pipeline, tools, permissions, response generation), failures were explained ad hoc as string lists. Developers need a single classification model, a stable response shape for logs and UI, and recovery hints aligned with Architecture/22 Failure Handling — without inventing a separate monitoring stack.

## Decision

1. Add `@atlas-ai/core` error module with categories **User / Tool / System / AI** and `AtlasErrorResponse` (id, code, message, userMessage, recoverable, recovery, traceId, timestamp).
2. Classify from codes / messages; expose `AtlasError`, `createAtlasError`, `fromUnknown`, and `ErrorHandler` (classify + structured log via `@atlas-ai/logging`).
3. Suggest recovery strategies (`retry`, `ask_user`, `use_alternative`, `notify`, …) without auto-executing them in MVP.
4. Wire pipeline + response: execution failures and response-layer errors populate `PipelineResponse.structuredErrors`; unexpected stage throws yield a degraded failed `PipelineResult` after logging.

## Consequences

### Positive

- Consistent structure for adapters and future Activity UI.
- Errors are logged with category, code, and `traceId`.
- Users get plain-language `userMessage` and recovery next steps.

### Negative / trade-offs

- Recovery is advisory only; no automatic retry loop yet.
- Degraded pipeline stubs (empty plan/context) are minimal placeholders.

### Follow-ups

- Optional auto-retry for idempotent tool steps.
- Desktop UI rendering of `structuredErrors`.
- Align tool-layer errors to always emit Atlas codes at the boundary.
