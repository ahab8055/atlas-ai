# ADR-0036: AI runtime monitoring foundation

- **Status:** Accepted
- **Date:** 2026-07-16
- **Deciders:** Atlas AI project team

## Context

Architecture/25 Model Health Monitoring requires load time, inference speed, memory usage, and errors. Architecture/15 MVP calls for health checks, local logs, basic metrics, and error reports. `ModelRuntimeManager` already exposes phase/memory snapshots and `GenerateResult.durationMs` exists per call, but timings were not aggregated and load duration was not recorded.

## Decision

1. Add `AiRuntimeMonitor` in `@atlas-ai/ai` (`packages/ai/src/runtime-monitoring/`) as an in-process ring buffer (default 100 events).
2. Record load duration in `ModelRuntimeManager.ensureLoaded` (`lastLoadDurationMs` + `recordLoad`); record inference/errors/status from `AiRuntime.generate` / `stream` / load paths.
3. Expose `AiRuntime.getMetrics()` / `getRecentMetricEvents()` and CLI `atlas ai metrics` / `metrics recent`.
4. Emit diagnosis `warnings` for slow load (≥10s), slow inference (≥30s), and memory over soft budget.
5. Enrich structured logs (`category: "ai"`) with `durationMs` and error `code` — no remote telemetry.

## Consequences

### Positive

- Developers can diagnose slow loads, slow inference, and OOM-risk budgets locally.
- Errors are both counted in metrics and logged with context.
- Fits process-scoped runtime state (same model as ADR-0032).

### Negative / trade-offs

- Metrics do not persist across CLI process boundaries.
- Memory figures remain estimates (weight size), not live RSS/VRAM.

### Follow-ups

- Optional SQLite/local metrics retention (Architecture/15 storage); desktop runtime panel; GPU probes.
