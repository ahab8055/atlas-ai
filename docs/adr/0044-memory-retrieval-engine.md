# ADR-0044: Memory retrieval engine

- **Status:** Accepted
- **Date:** 2026-07-17
- **Deciders:** Atlas AI project team

## Context

Architecture/04 requires relevance-based memory retrieval (semantic similarity +
recency) and injection into AI context. ADR-0042 shipped lexical
`LongTermMemory.search` and CLI `createRetriever`, but ranking lacked an
explicit recency term and semantic signal, and plan/response ignored
`LoadedContext.memories`.

## Decision

1. Add `MemoryRetrievalEngine` in `@atlas-ai/memory` with hybrid weights:
   semantic 0.40, lexical 0.25, importance 0.15, confidence 0.05, recency 0.15.
2. Keep retrieval **sync** (local hash vectors + optional stored embedding
   lookup) so `ContextManager` / `runPipeline` stay synchronous.
3. Route `LongTermMemory.search` / `createRetriever` through the engine;
   expose `retrieve()` with scores.
4. Config under `memory.retrieval` (+ `ATLAS_MEMORY_RETRIEVAL_*` env).
5. Surface recalled memories in plan goals and completed responses.
6. CLI: `atlas memory retrieve "query"`.

## Consequences

### Positive

- Related queries return ranked memories with scores.
- Recency participates in ranking, not only as a tie-break.
- Context assembly remains automatic on the CLI DB path.

### Negative / trade-offs

- Semantic score uses deterministic local vectors (not a full embedding model
  in the hot path); live EmbeddingService query embeds remain a follow-up.

### Follow-ups

- Async context load for real embedding models.
- Wire `onStored` to `collection=memory` embedAndStore by default.
- [Memory-Retrieval.md](../guides/Memory-Retrieval.md)
