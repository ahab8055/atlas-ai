# Atlas AI — Memory Analytics

Developer diagnostics for long-term memory: durable store counts/storage plus
process-scoped retrieval and consolidation metrics (ADR-0058).

Related: [Long-Term-Memory.md](./Long-Term-Memory.md),
[Memory-Retrieval.md](./Memory-Retrieval.md),
[Memory-Consolidation.md](./Memory-Consolidation.md),
[Runtime-Monitoring.md](./Runtime-Monitoring.md) (AI runtime pattern),
[Logging.md](./Logging.md),
[CLI.md](./CLI.md),
[ADR-0058](../adr/0058-memory-analytics.md),
[`@atlas-ai/memory`](../../packages/memory/).

---

## Goals

- Report **how many** memories are stored (by type, sensitive, encrypted)
- Approximate **content storage** without loading all rows
- Aggregate **retrieval timing** in the current process (avg/min/max, slow count)
- Roll up **consolidation** outcomes (merged / conflicts / skipped)
- Expose via `LongTermMemory.getStats()` and `atlas memory stats`

---

## What is measured

| Section                                                      | Source                         | Lifetime |
| ------------------------------------------------------------ | ------------------------------ | -------- |
| Store totals / byType / sensitive / encrypted / contentBytes | SQL aggregates on `memories`   | Durable  |
| openConflicts                                                | Count of conflict-flagged rows | Durable  |
| Retrieval timing + slowRetrievals (≥500ms) + recent samples  | `MemoryAnalyticsMonitor`       | Process  |
| Consolidation counters + lastConsolidation                   | Monitor                        | Process  |

**Out of scope:** remote telemetry, durable metrics DB, desktop dashboard,
SM-MEM accuracy labeling, whole-device RAM (Architecture/15 “Memory Monitoring”
refers to model RAM — see [Runtime-Monitoring.md](./Runtime-Monitoring.md)).

---

## API

```ts
import {
  createLongTermMemory,
  createMemoryAnalyticsMonitor,
} from "@atlas-ai/memory";

const analytics = createMemoryAnalyticsMonitor();
const ltm = createLongTermMemory(db.memories, { analytics });

ltm.retrieve("TypeScript"); // records tookMs into analytics
ltm.consolidate(); // records merge/conflict counters

const report = ltm.getStats(); // store + process + openConflicts
const processOnly = ltm.getMetrics();
```

`searchMemories` / `retrieve` record retrieval samples. `consolidate` records
duplicate-handling outcomes. The CLI shares one monitor for the process
lifetime (same pattern as the memory access log).

---

## CLI

```bash
pnpm atlas memory stats
pnpm atlas memory retrieve "dark mode"   # prints tookMs=… footer
```

`memory stats` prints store snapshot, retrieval timing, and duplicate counters.

---

## Defaults

- Slow retrieval threshold: **500ms** (Architecture/04 / Memory-Retrieval NFR)
- Recent retrieval ring: **50** samples
- No remote export; local diagnostics only
