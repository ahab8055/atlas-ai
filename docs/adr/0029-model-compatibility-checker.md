# ADR-0029: Model compatibility checker

- **Status:** Accepted
- **Date:** 2026-07-16
- **Deciders:** Atlas AI project team

## Context

Architecture/25 requires compatibility checks (RAM, storage, CPU, GPU, OS) before models are used. Installation (ADR-0028) already surfaces **warnings**. Users still need a dedicated checker that identifies **unsupported** models and **prevents execution** when requirements are not met.

## Decision

1. Add `checkModelCompatibility` / `assertModelCompatible` in `@atlas-ai/ai` covering RAM, CPU, GPU, and storage.
2. Support modes: `install` (advisory) and `runtime` (hard errors block load).
3. Gate `AiRuntime.loadModel` / `generate` when `compatibility.enabled` + resolver metadata are configured.
4. CLI: `atlas ai check [modelId]`; `load` / `ask` enforce the runtime gate using registry requirements.
5. Reuse the shared checker from install compatibility mapping.

## Consequences

### Positive

- Clear supported/unsupported reports for users.
- Incompatible models cannot be loaded through the gated runtime path.
- Install remains permissive with warnings; run is strict.

### Negative / trade-offs

- Enforcement depends on registry metadata (`requirements` / `sizeBytes`); unknown models only get partial checks.
- GPU preference (`acceleration: "gpu"`) becomes a hard runtime error (use `any`/`cpu` for optional GPU).

### Follow-ups

- Richer VRAM budgeting; optional override flag `--force` for power users.
