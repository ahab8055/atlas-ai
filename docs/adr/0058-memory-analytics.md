# ADR-0058: Memory Analytics

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** Atlas AI project team

## Context

Developers need visibility into long-term memory health: how many rows exist,
approximate storage, retrieval latency, and consolidation outcomes. Per-call
`tookMs` on the Search API was discarded by higher layers; there was no
`COUNT`/`SUM` store snapshot API. Architecture/15 “Memory Monitoring” targets
model RAM, not the memories table — a separate concern.

## Decision

1. Add **`MemoriesRepository.stats()`** with SQL aggregates (`COUNT`,
   `GROUP BY type`, sensitive/encrypted filters, `SUM(LENGTH(content))`).
2. Add **`packages/memory/src/analytics/`** modeled on AI
   `runtime-monitoring`: in-process `MemoryAnalyticsMonitor` with
   `TimingStats`, slow-retrieval threshold (500ms), consolidation counters,
   and a recent retrieval ring.
3. Wire **`LongTermMemory.getStats()`** / `getMetrics()`; record on
   `searchMemories`/`retrieve` and `consolidate`.
4. CLI **`atlas memory stats`** plus a **`tookMs=`** footer on
   `memory retrieve`. No remote telemetry or durable metrics DB in MVP.

## Consequences

### Positive

- Fast store diagnostics without loading all rows.
- Process-local retrieval/consolidation visibility for CLI debugging.
- Aligns with existing AI runtime-monitoring patterns.

### Negative / trade-offs

- Process metrics reset on restart (by design).
- `contentBytes` is an approximation (content length + tags estimate), not
  full SQLite page usage.

## Related

- [Memory-Analytics.md](../guides/Memory-Analytics.md)
- [Runtime-Monitoring.md](../guides/Runtime-Monitoring.md)
- [ADR-0036](./0036-ai-runtime-monitoring.md)
- [ADR-0042](./0042-long-term-memory.md)
- [ADR-0044](./0044-memory-retrieval-engine.md)
- [ADR-0045](./0045-memory-consolidation-service.md)
