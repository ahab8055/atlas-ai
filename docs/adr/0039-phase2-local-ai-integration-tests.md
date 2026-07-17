# ADR-0039: Phase 2 Local AI integration tests

- **Status:** Accepted
- **Date:** 2026-07-17
- **Deciders:** Atlas AI project team

## Context

Phase 2 (Local AI Engine) spans `@atlas-ai/ai` modules: runtime, mock/llamacpp
providers, model router, hardware detection, install, offline policy, and
monitoring. Unit tests cover modules in isolation. Regressions often appear at
boundaries (load → route → generate, offline install blocks, provider gates).
CI must prove these workflows without requiring GGUF weights or a live
`llama-server`.

## Decision

1. Add `tests/integration/phase2-local-ai.test.ts` for cross-package Local AI
   workflows, mirroring Phase 1 (`tests/integration/phase1-core-runtime.test.ts`).
2. Add `tests/integration/ai-helpers.ts` with `createLocalAiHarness` — fresh
   `InferenceProviderRegistry`, mock provider, offline defaults, optional temp
   `modelsDir` / router catalog.
3. Cover: model load, inference (generate/stream/metrics), routing, hardware
   detection, offline operation, and a **critical path** smoke.
4. Keep CI on the **mock** provider; retain optional live probe in
   `ai-runtime.test.ts` behind `describe.skipIf(!ATLAS_AI_ENDPOINT)`.
5. Document in `Phase2-Local-AI-Integration-Testing.md`; run via existing
   `pnpm test:integration`.

## Consequences

### Positive

- Automated proof that Local AI Engine pieces work together offline.
- Critical regressions fail Vitest loudly in CI without model downloads.
- Live llama remains opt-in for developers with a local server.

### Negative / trade-offs

- Mock paths do not exercise real GGUF load or llama.cpp IPC.
- Integration suite still depends on built `dist/` packages.

### Follow-ups

- Optional CI job with a tiny fixture GGUF when storage/cache is available.
- Desktop/CLI e2e remains out of scope (`tests/e2e/`).
