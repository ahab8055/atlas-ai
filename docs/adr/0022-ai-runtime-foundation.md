# ADR-0022: AI runtime foundation

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Atlas AI project team

## Context

Phase 1 core runtime is heuristic (intent/plan/tools/response). Architecture requires local offline inference (llama.cpp, GGUF) with technology independence so engines can change later. Putting llama.cpp inside `@atlas-ai/core` would couple orchestration to one backend and complicate CI without weights.

## Decision

1. Add package `@atlas-ai/ai` (`packages/ai`) owning inference behind `InferenceProvider`.
2. Ship two providers: **`mock`** (default, offline/CI) and **`llamacpp`** (HTTP to local `llama-server`, OpenAI-compatible `/v1/chat/completions`).
3. Expose `AiRuntime` facade (`health`, `loadModel`, `generate`, `stream`, `useProvider`) for CLI and future core wiring.
4. Do **not** replace heuristic `ResponseGenerator` in this slice; only probe via `atlas ai status`.
5. Config block `ai.{provider,endpoint,defaultModelId}` plus env overrides.

## Consequences

### Positive

- Atlas communicates with a local AI runtime without embedding C++.
- Model execution stays outside core.
- Registry supports additional runtimes (ONNX, cloud) without API redesign.

### Negative / trade-offs

- Real inference requires a separately running `llama-server` and GGUF weights.
- Model “load” for llama.cpp is selection/tracking; process-level model load remains with the server.

### Follow-ups

- Wire planning/response optional LLM polish behind the same facade.
- Hardware detection and Model Router (Architecture/25).
- Optional native bindings if HTTP is insufficient for latency targets.
