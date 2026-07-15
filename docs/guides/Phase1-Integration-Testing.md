# Atlas AI — Phase 1 Core Runtime Integration Tests

Cross-package Vitest suite proving Phase 1 components work together.

Related: [Testing.md](./Testing.md), [Request-Pipeline.md](./Request-Pipeline.md), [Tool-Execution.md](./Tool-Execution.md), [Task-Planning.md](./Task-Planning.md), [Security.md](./Security.md), [Error-Handling.md](./Error-Handling.md), [ADR-0021](../adr/0021-phase1-core-runtime-integration-tests.md), [`tests/integration/`](../../tests/integration/).

---

## Scope

| Area             | What is verified                                            |
| ---------------- | ----------------------------------------------------------- |
| Request pipeline | Full stages + orchestration events + multi-source inputs    |
| Tool execution   | Echo / `system.info` / registry list through pipeline + API |
| Planning         | Simple + multi-step plans; ordered execution when granted   |
| Permissions      | Block without grant; Trusted Execution; approve → retry     |
| Error handling   | Structured user/system errors, logging, degraded throw path |
| Critical path    | Aggregated smoke that fails loudly on Phase 1 regressions   |

---

## Commands

```bash
pnpm test:integration   # packages:build + Vitest tests/integration only
pnpm test               # full Vitest suite (unit + integration)
```

---

## Layout

```
tests/integration/
├── helpers.ts                      # isolated runtime harness
└── phase1-core-runtime.test.ts     # Phase 1 workflow suites
```

Harness always injects its own `PermissionManager` / `ExecutionController` / `EventBus` / logger so cases stay isolated.

---

## Acceptance mapping

| Acceptance criterion                      | How covered                                       |
| ----------------------------------------- | ------------------------------------------------- |
| Core runtime workflow has automated tests | All describes under `phase1-core-runtime.test.ts` |
| Critical failures are detected            | `critical path stability` suite                   |
| Phase 1 functionality is stable           | Happy + failure paths for story examples          |
