# Atlas AI — Model Runtime Manager

Controls model execution: load, unload, sessions, and memory (Architecture/25 AI Runtime Manager).

Related: [Local-AI-Runtime.md](./Local-AI-Runtime.md), [Inference-Configuration.md](./Inference-Configuration.md), [Model-Router.md](./Model-Router.md), [Hardware-Detection.md](./Hardware-Detection.md), [ADR-0032](../adr/0032-model-runtime-manager.md), [`@atlas-ai/ai`](../../packages/ai/).

---

## Purpose

- **Load models when needed** (`ensureLoaded` / `loadModel`).
- **Unload unused models** (explicit unload, idle reclaim, capacity eviction).
- **Track active model state** (phase, loaded set, last used).
- **Manage inference sessions** (open/close; open sessions block idle unload).
- **Control memory** via estimated weight sizes and a soft budget.

---

## Runtime flow

```
Request → Model Selection → Load Model → Generate → Unload / Keep Loaded
```

Default: **one loaded model** at a time (matches typical llama.cpp server).

---

## CLI

```bash
pnpm atlas ai runtime                 # snapshot (phase, models, memory, sessions)
pnpm atlas ai runtime load [modelId]
pnpm atlas ai runtime unload [modelId]
pnpm atlas ai runtime reclaim         # unload idle models (no open sessions)
pnpm atlas ai runtime sessions
pnpm atlas ai runtime session start [modelId]
pnpm atlas ai runtime session end <sessionId>

# load also prints runtime snapshot
pnpm atlas ai load mock-general
```

Note: each CLI invocation is a new process — state is tracked **within** a long-lived runtime (desktop/core). Use `load`/`unload`/`reclaim` in one session for interactive control.

---

## API

```ts
import { createAiRuntime, formatRuntimeSnapshot } from "@atlas-ai/ai";

const ai = createAiRuntime({
  provider: "mock",
  defaultModelId: "mock-general",
  modelRuntime: {
    maxLoadedModels: 1,
    idleUnloadMs: 5 * 60_000,
    memoryBudgetBytes: 8 * 1024 ** 3,
  },
});

await ai.loadModel();
const session = await ai.createInferenceSession();
console.log(formatRuntimeSnapshot(ai.getRuntimeSnapshot()));

await ai.generate({ messages: [{ role: "user", content: "hi" }] });
ai.endInferenceSession(session.id);
await ai.reclaimIdleModels();
await ai.unloadModel();
```

### Snapshot fields

| Field        | Meaning                                                       |
| ------------ | ------------------------------------------------------------- |
| `phase`      | `idle` / `loading` / `ready` / `busy` / `unloading` / `error` |
| `loaded[]`   | Active weights + estimated memory + session counts            |
| `sessions[]` | Open/closed inference sessions                                |
| `memory`     | Estimated used bytes vs soft budget                           |

---

## Memory control

- Estimates use registry/disk `sizeBytes` when available.
- Soft budget defaults to ~50% of host RAM when host memory is set.
- Before loading, the manager evicts idle models to respect `maxLoadedModels` and budget.

---

## Out of scope

Multi-process shared state, GPU VRAM budgeting beyond estimates, warm model pools beyond `maxLoadedModels`.
