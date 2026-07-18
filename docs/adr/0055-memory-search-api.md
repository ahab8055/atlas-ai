# ADR-0055: Memory Search API

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** Atlas AI project team

## Context

Modules searched long-term memory through `LongTermMemory.search` /
`retrieve`, ad hoc `list` + scoring, or an unused `MemoryManager.query` path.
Keyword and semantic ranking existed only as hybrid weight components; filters
like `sessionId` were missing from retrieve. Callers needed one documented
entry with explicit modes.

## Decision

1. Add sync **`MemorySearchApi`** in `@atlas-ai/memory` wrapping
   `MemoryRetrievalEngine`.
2. Support modes **`keyword` | `semantic` | `hybrid`** via weight presets
   (lexical-heavy, semantic-heavy, or `DEFAULT_RETRIEVAL_WEIGHTS`).
3. Expose filters: `type`, `tags`, `userId`, `sessionId`, `projectId`,
   `limit`, `minScore`, `recencyHalfLifeMs`; return `hits`, `mode`, `tookMs`.
4. Route `LongTermMemory.search` / `retrieve` / `createRetriever` through the
   Search API so CLI and core share one path.
5. Keep semantic scoring in-process (hash vectors + optional stored embedding
   boost); no live EmbeddingService in the hot path.

## Consequences

### Positive

- One interface for keyword, semantic, and hybrid queries.
- Session and tag filters available on the same path as hybrid retrieval.
- Core retriever and CLI stay aligned.

### Negative / trade-offs

- Modes are weight presets over the existing engine, not separate indexes
  (no FTS/ANN in this slice).
- Knowledge / file search remains separate (Architecture/24).

### Follow-ups

- Optional HTTP `POST /memories/search`.
- Cross-source Retrieval Orchestrator.
- FTS5 / ANN when corpora grow beyond in-process list+score.
