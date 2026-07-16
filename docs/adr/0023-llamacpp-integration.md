# ADR-0023: llama.cpp integration

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Atlas AI project team

## Context

ADR-0022 introduced `@atlas-ai/ai` with a thin HTTP `LlamaCppProvider`. The product stack (Architecture/17) requires llama.cpp + GGUF as the primary local engine, with configurable loading/inference and CPU-first hardware (GPU later).

## Decision

1. Keep llama.cpp behind `InferenceProvider` / `LlamaCppProvider` (no coupling into `@atlas-ai/core`).
2. **GGUF load path:** resolve under `modelsDir`, validate magic `GGUF`, then either:
   - attach to an existing `llama-server`, or
   - spawn managed `llama-server` when `ai.llamaCpp.manageServer` is true.
3. **Inference params** live in config + `GenerateRequest` overrides (`temperature`, `maxTokens`, `topP`, `topK`, `repeatPenalty`).
4. **Hardware profile** defaults to `acceleration: "cpu"` and `gpuLayers: 0` (`-ngl 0`). GPU mode is wired via the same profile (`gpuLayers > 0`) without a second provider.
5. CLI: `atlas ai load`, `atlas ai ask`, `atlas ai models`, enhanced `atlas ai status`.

## Consequences

### Positive

- Atlas can load a supported GGUF and complete prompt → response through the abstraction.
- CPU works out of the box; GPU is a config flip + layers, not a rewrite.
- CI remains online via `mock` without weights.

### Negative / trade-offs

- Managed server requires `llama-server` on PATH.
- Native in-process llama.cpp (node bindings) still deferred.

### Follow-ups

- Optional model download / registry UX.
- Wire suggested hardware profile into setup / Model Router (see ADR-0026).
