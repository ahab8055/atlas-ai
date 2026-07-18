# Atlas AI — Phase 3 Memory Integration Tests

Cross-package Vitest suite proving Memory & Personal Context workflows work
together (MVP-Plan Phase 3).

Related: [Testing.md](./Testing.md), [Long-Term-Memory.md](./Long-Term-Memory.md),
[Short-Term-Memory.md](./Short-Term-Memory.md), [Memory-Retrieval.md](./Memory-Retrieval.md),
[Memory-Consolidation.md](./Memory-Consolidation.md), [Memory-Backup.md](./Memory-Backup.md),
[Memory-Analytics.md](./Memory-Analytics.md), [Knowledge-Graph.md](./Knowledge-Graph.md),
[User-Profile.md](./User-Profile.md), [Preference-Learning.md](./Preference-Learning.md),
[Workspace-Awareness.md](./Workspace-Awareness.md), [Context-Management.md](./Context-Management.md),
[ADR-0059](../adr/0059-phase3-memory-integration-tests.md),
[`tests/integration/`](../../tests/integration/).

---

## Scope

| Area                     | What is verified                                                    |
| ------------------------ | ------------------------------------------------------------------- |
| Memory storage & updates | Store / classify+store / update / get; sensitive encrypt round-trip |
| Retrieval & context      | Retrieve / search → `LoadedContext.memories`                        |
| Consolidation            | Near-dup merge + conflict flags + stats                             |
| Knowledge graph          | Extract → link → retrieve → context knowledge snippets              |
| Personalization          | Profile set / learn → approve → preferences in context              |
| Workspace scoping        | Active project + `projectId` memory search                          |
| Backup                   | Export → clear → import; encrypted envelope round-trip              |
| Short-term window        | STM turns alongside LTM                                             |
| Critical path            | Aggregated smoke that fails loudly on Phase 3 regressions           |

**Out of scope:** live embeddings / llama, desktop UI, CLI argv parsing (covered in
`apps/cli` unit tests), remote telemetry.

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
├── helpers.ts                 # Phase 1 core runtime harness
├── ai-helpers.ts              # Phase 2 Local AI harness
├── memory-helpers.ts          # Phase 3 memory / personal-context harness
├── phase1-core-runtime.test.ts
├── phase2-local-ai.test.ts
└── phase3-memory.test.ts      # Phase 3 workflow suites
```

Harness always uses SQLite `:memory:`, fresh permissions/DEK, and
`try/finally { harness.cleanup() }`.

---

## Acceptance mapping

| Acceptance criterion                          | How covered                                 |
| --------------------------------------------- | ------------------------------------------- |
| Complete memory lifecycle has automated tests | All describes under `phase3-memory.test.ts` |
| Storage, retrieval, updates, consolidation    | Describes 1–3                               |
| Knowledge graph + personalization             | Describes 4–5 (+ workspace)                 |
| Backup workflows                              | Backup describe                             |
| Critical workflows pass                       | `critical path stability` suite             |
