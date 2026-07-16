# ADR-0032: Model runtime manager

- **Status:** Accepted
- **Date:** 2026-07-16
- **Deciders:** Atlas AI project team

## Context

Architecture/25 defines an **AI Runtime Manager** that loads/unloads models, switches models, and monitors inference. `AiRuntime` already delegated to a single `InferenceProvider` but did not track sessions, idle unload, or memory budgets. Users need efficient resource use: load on demand, unload unused weights, and visible runtime state.

## Decision

1. Add `ModelRuntimeManager` in `@atlas-ai/ai` (`packages/ai/src/model-runtime/`) owning load/unload orchestration, phase tracking, inference sessions, and soft memory accounting.
2. Default `maxLoadedModels: 1` (llama.cpp-friendly); idle reclaim after `idleUnloadMs` when no open sessions; soft `memoryBudgetBytes` from host RAM when available.
3. Wire `AiRuntime` through the manager for `loadModel` / `unloadModel` / `ensureLoaded`, and expose `getRuntimeSnapshot`, `createInferenceSession`, `reclaimIdleModels`.
4. CLI: `atlas ai runtime` (status/load/unload/reclaim/sessions); `load` prints a runtime snapshot.

## Consequences

### Positive

- Dynamic load/unload with explainable state.
- Sessions keep hot models alive during multi-turn work; idle reclaim frees memory afterward.
- Soft memory budget guides eviction before OOM-prone loads.

### Negative / trade-offs

- CLI is process-scoped — runtime state does not persist across separate `pnpm atlas` invocations.
- Memory estimates depend on registry `sizeBytes`; unknown sizes skip precise budgeting.
- Provider `unload()` is global (one active backend model); multi-slot loading is prepared but limited by backends.

### Follow-ups

- Persist session metadata optionally; richer VRAM probes; desktop UI for runtime panel.
