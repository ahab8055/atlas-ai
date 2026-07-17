# Atlas AI — Phase 2 Local AI Integration Tests

Cross-package Vitest suite proving Local AI Engine workflows work together
without a live llama-server or GGUF weights in CI.

Related: [Testing.md](./Testing.md), [Local-AI-Runtime.md](./Local-AI-Runtime.md),
[Model-Router.md](./Model-Router.md), [Hardware-Detection.md](./Hardware-Detection.md),
[Offline-Mode.md](./Offline-Mode.md), [AI-Providers.md](./AI-Providers.md),
[ADR-0039](../adr/0039-phase2-local-ai-integration-tests.md),
[`tests/integration/`](../../tests/integration/).

---

## Scope

| Area                | What is verified                                             |
| ------------------- | ------------------------------------------------------------ |
| Model loading       | `mock-general` / `mock-coding` load, unload, unknown → error |
| Inference execution | `generate` / `stream` + metrics                              |
| Model routing       | Coding prompt → coding model; manual prefer; empty catalog   |
| Hardware detection  | Profile + memory/CPU; resource profiles; recommend           |
| Offline operation   | URL install blocked; mock still works; no cloud stub         |
| Critical path       | Aggregated smoke that fails loudly on Phase 2 regressions    |

**Out of CI by default:** real GGUF / llama-server (optional live probe in
`ai-runtime.test.ts` when `ATLAS_AI_ENDPOINT` is set).

---

## Commands

```bash
pnpm test:integration   # packages:build + Vitest tests/integration only
pnpm test               # full Vitest suite (unit + integration)
```

Optional live llama probe (skipped in CI):

```bash
ATLAS_AI_ENDPOINT=http://127.0.0.1:8080 pnpm test:integration
```

---

## Layout

```
tests/integration/
├── helpers.ts                 # Phase 1 core runtime harness
├── ai-helpers.ts              # Phase 2 Local AI harness (mock provider)
├── phase1-core-runtime.test.ts
├── phase2-local-ai.test.ts    # Phase 2 workflow suites
└── ai-runtime.test.ts         # optional live llama probe
```

Harness defaults: `provider: "mock"`, `offlineMode: true`, `cloudProviders: false`,
injected router catalog, optional temp `modelsDir` for install paths.

---

## Acceptance mapping

| Acceptance criterion       | How covered                                       |
| -------------------------- | ------------------------------------------------- |
| Local AI workflow covered  | Describes 1–6 under `phase2-local-ai.test.ts`     |
| Supported models execute   | `mock-general` / `mock-coding` load + generate    |
| Critical failures detected | `critical path stability` suite + Vitest non-zero |
