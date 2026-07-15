# ADR-0007: Request processing pipeline in `@atlas-ai/core`

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Atlas AI project team

## Context

MVP Phase 1 requires a core runtime that accepts commands, runs them through defined stages, and produces consistent responses. Architecture/22 defines Request Analyzer, Context Manager, Planner, Tool Selection, and Response Generator, plus orchestration events. Input will start as CLI and later include desktop and voice.

## Decision

1. Implement the pipeline in `@atlas-ai/core` (MVP `packages/` layout — not Architecture-19 `services/`).
2. Stages: normalize → intent → context → planning → execution → response.
3. Log Architecture/22 orchestration events with a per-request `traceId` via `@atlas-ai/logging`.
4. Keep input adapters thin: `@atlas-ai/cli` today; desktop/voice call the same `handleRequest` with a different `InputSource`.
5. Use heuristic intent and stub tools for Phase 1; call `@atlas-ai/security` before capability-bearing steps.

## Consequences

### Positive

- One pipeline for all future inputs.
- Traceable stage logs from day one.
- Clear boundary for later memory/tools/agents packages.

### Negative / trade-offs

- Intent/tools are stubs until models and `@atlas-ai/tools` land.
- No async event bus yet — events are log messages.

### Follow-ups

- Wire memory into context loading.
- Replace stubs with tool registry and agent planner.
- Desktop IPC path into `handleRequest`.
