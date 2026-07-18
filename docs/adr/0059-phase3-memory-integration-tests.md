# ADR-0059: Phase 3 Memory integration tests

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** Atlas AI project team

## Context

MVP Phase 3 (Memory & Personal Context) spans `@atlas-ai/memory`,
`@atlas-ai/knowledge`, `@atlas-ai/profile`, `@atlas-ai/workspace`,
`@atlas-ai/database`, and core context providers. Colocated unit tests and CLI
handler tests cover modules in isolation. Regressions often appear at
boundaries (store → retrieve → context, KG extract → snippets, profile learn →
preferences, backup restore → retrieve). CI needs a cross-package suite without
live embeddings or a desktop shell.

## Decision

1. Add `tests/integration/phase3-memory.test.ts` for Memory & Personal Context
   workflows, mirroring Phase 1/2 integration suites.
2. Add `tests/integration/memory-helpers.ts` with `createMemoryHarness` —
   SQLite `:memory:`, LTM/STM, knowledge graph, profile, workspace,
   `ContextManager` providers, permissions/DEK/analytics; `cleanup()` closes DB.
3. Cover: storage/updates, retrieval→context, consolidation, knowledge graph,
   personalization, workspace scoping, backup, short-term window, and a
   **critical path** smoke.
4. Keep harness on package managers + context load — do not pull
   `createCliRuntime` (CLI parsing stays in `apps/cli` unit tests).
5. Document in `Phase3-Memory-Integration-Testing.md`; run via existing
   `pnpm test:integration`.

## Consequences

### Positive

- Automated proof that Phase 3 pieces work together in CI.
- Critical regressions fail Vitest loudly without model downloads.

### Negative / trade-offs

- Does not exercise CLI argv parsing or post-request side-effect helpers in
  `run.ts` (`maybeExtractKnowledge` / `maybeLearnProfile`); those remain
  covered via package APIs and CLI unit tests.

## Related

- [Phase3-Memory-Integration-Testing.md](../guides/Phase3-Memory-Integration-Testing.md)
- [ADR-0021](./0021-phase1-core-runtime-integration-tests.md)
- [ADR-0039](./0039-phase2-local-ai-integration-tests.md)
- [MVP-Plan Phase 3](../product/MVP-Plan.md)
