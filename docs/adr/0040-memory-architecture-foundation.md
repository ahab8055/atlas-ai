# ADR-0040: Memory architecture foundation

- **Status:** Accepted
- **Date:** 2026-07-17
- **Deciders:** Atlas AI project team

## Context

Architecture/04 defines working, episodic, semantic, and procedural memory plus
a Memory Manager. Context management (ADR-0009) already exposes a swappable
`createMemoryProvider` port, but there was no `@atlas-ai/memory` package.
Developers need a modular abstraction so types stay isolated and future
backends (SQLite, vectors) can plug in without rewriting callers.

## Decision

1. Add `@atlas-ai/memory` with `MemoryProvider` port, `MemoryProviderRegistry`,
   and `MemoryManager` facade.
2. Canonical `MemoryType`: `working` | `episodic` | `semantic` | `procedural`.
   Map user-story short-term / long-term to `MemoryScope` (`short_term` /
   `long_term`).
3. Ship four isolated in-memory providers (separate Map per type); register via
   `registerBuiltinMemoryProviders`.
4. Use async provider APIs so durable adapters do not break the port later.
5. Export `toMemorySnippets` for core context compatibility; do **not** wire
   the request pipeline in this slice.
6. Document in Memory-Architecture.md; no SQLite/vector/HTTP in this ADR.

## Consequences

### Positive

- Modular memory architecture with clear type isolation.
- New providers register without changing `MemoryManager`.
- Aligns with Architecture/04 and existing `MemorySnippet.kind`.

### Negative / trade-offs

- In-memory only — data is process-local until a durable provider exists.
- Pipeline still does not inject memories by default.

### Follow-ups

- SQLite memory provider + schema (Architecture/20).
- Wire `MemoryManager.query` into `createMemoryProvider`.
- Vector ranking via `@atlas-ai/ai` embeddings.
