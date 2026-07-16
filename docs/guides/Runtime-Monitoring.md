# Atlas AI — Runtime Monitoring

Local visibility into AI model performance: load time, inference duration, memory, errors, and runtime status (Architecture/15 Monitoring, Architecture/25 Model Health Monitoring).

Related: [Local-AI-Runtime.md](./Local-AI-Runtime.md), [Model-Runtime-Manager.md](./Model-Runtime-Manager.md), [Logging.md](./Logging.md), [Architecture/15](../Architecture/15-Monitoring-Architecture.md), [ADR-0036](../adr/0036-ai-runtime-monitoring.md), [`@atlas-ai/ai`](../../packages/ai/).

---

## Purpose

- **Track model loading time** (`recordLoad` / `lastLoadDurationMs`).
- **Track inference duration** (generate/stream aggregates).
- **Track memory usage** (estimated weights + soft budget from runtime snapshot).
- **Track errors** (monitor history + structured `category: "ai"` logs).
- **Track runtime status** (phase / active model via status samples).

---

## Defaults

- In-process ring buffer (**100** events) — no remote telemetry, no SQLite yet.
- Slow-load warning at **10s** (Architecture/25 load target).
- Slow-inference warning at **30s**.
- Memory-over-budget when soft budget is exceeded.

---

## CLI

```bash
pnpm atlas ai metrics           # aggregates + warnings (this process)
pnpm atlas ai metrics recent    # recent events

# Metrics accumulate during the same process as load/ask/runtime:
pnpm atlas ai runtime load mock-general
# (library / long-lived desktop process: AiRuntime.getMetrics())
```

Note: each `pnpm atlas` invocation is a new process — same limitation as `atlas ai runtime`.

---

## API

```ts
import { createAiRuntime, formatAiRuntimeMetrics } from "@atlas-ai/ai";

const ai = createAiRuntime({
  provider: "mock",
  defaultModelId: "mock-general",
});
await ai.loadModel();
await ai.generate({ messages: [{ role: "user", content: "hi" }] });

console.log(formatAiRuntimeMetrics(ai.getMetrics()));
console.log(ai.getRecentMetricEvents(10));
```

### Metric fields

- `load` / `inference` — count, avg/min/max ms
- `errorCount` / `lastErrors`
- `status` — latest phase + memory sample
- `warnings` — `slow_load` | `slow_inference` | `memory_over_budget`

---

## Logging

Successful load/generate and failures emit structured logs with `category: "ai"` and `durationMs` (and `code` when `AiRuntimeError`).

---

## Out of scope

Remote telemetry, desktop metrics dashboard, GPU/VRAM probes, durable metrics DB.
