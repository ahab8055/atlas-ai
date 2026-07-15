# ADR-0016: Event system integration

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Atlas AI project team

## Context

Architecture/10 requires an event-driven bus so Atlas components stay modular. The pipeline already logged Architecture/22 orchestration event _names_ via `@atlas-ai/logging`, but there was no publish/subscribe API—subscribers could not react without coupling to the pipeline. Technology stack MVP calls for a Node.js in-process event bus (SQLite store later).

## Decision

1. Add `EventBus` in `@atlas-ai/core` (`packages/core/src/events/`) with `publish`, `subscribe`, `once`, and in-memory history.
2. Standardize event envelopes as Architecture/10: `id`, `type`, `timestamp`, `source`, `payload`, plus `traceId` for correlation.
3. Define `CORE_EVENTS` matching the user story / Architecture/22 (including `ContextLoaded`).
4. Have `runPipeline` publish each core event and continue mirroring to structured logs.
5. Allow injecting `eventBus` via `PipelineOptions` / `RequestHandlerOptions`.

## Consequences

### Positive

- Components can subscribe without depending on pipeline internals.
- Event structure is documented and typed.
- Logging and bus can coexist (observability + reaction).

### Negative / trade-offs

- Sync in-process delivery only (no persistence / cross-process yet).
- Subscriber errors are not isolated (handlers run inline; harden later).

### Follow-ups

- Persist events (SQLite event store).
- Isolate subscriber failures.
- Expand catalog (tool/security/voice events).
