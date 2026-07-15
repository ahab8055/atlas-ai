# ADR-0004: Structured local logging

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Atlas AI project team

## Context

Phase 0 requires application logging so operations can be monitored and debugged. Monitoring Architecture defines log categories, levels, and a JSON-like structure. Technology Stack recommends **`tracing`** for Rust and local logs for MVP (no mandatory cloud).

## Decision

1. Add **`@atlas-ai/logging`** for TypeScript — structured JSON records with levels, categories, error payloads, redaction, and pluggable sinks.
2. Use **`tracing` + `tracing-subscriber` (JSON)** in the Tauri/Rust desktop core.
3. Keep logging **local-first**; file/rotating sinks and monitoring ingestion come later using the same record shape.
4. Do not send logs remotely in MVP by default.

## Consequences

### Positive

- Consistent fields for future Monitoring Service ingestion.
- Errors carry stack/name/message for tracing failures.
- Aligns with privacy-first monitoring principles.

### Negative / trade-offs

- Two implementations (TS + Rust) until a shared correlation ID story exists (`traceId` reserved).

### Follow-ups

- Rotate logs under `.data/logs/` when the data layer lands.
- Wire `ATLAS_LOG_LEVEL` from `@atlas-ai/config` into desktop UI logger bootstrap.
- Documented in [`guides/Logging.md`](../guides/Logging.md).
