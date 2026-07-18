# Atlas AI — Memory Retrieval

Hybrid ranking so Atlas recalls relevant long-term memories into context automatically.

Related: [Memory-Search.md](./Memory-Search.md), [Long-Term-Memory.md](./Long-Term-Memory.md), [Memory-Classification.md](./Memory-Classification.md), [Context-Management.md](./Context-Management.md), [Architecture/04-Memory-Architecture.md](../Architecture/04-Memory-Architecture.md), [ADR-0044](../adr/0044-memory-retrieval-engine.md), [ADR-0055](../adr/0055-memory-search-api.md), [`@atlas-ai/memory`](../../packages/memory/).

---

## Goals

- Retrieve by semantic similarity + lexical overlap + importance/confidence + recency
- Rank and select top-K under a min score
- Inject into `LoadedContext.memories` and surface in plan/response
- Keep retrieval latency low (in-process; NFR under 500ms for MVP corpora)

---

## Flow

```
User query
  → MemorySearchApi.search (mode hybrid by default)
  → MemoryRetrievalEngine.retrieve()
  → hybrid score → top-K
  → createRetriever → LoadedContext.memories
  → plan goal note + response "Recalled memories"
```

Prefer [Memory-Search.md](./Memory-Search.md) for the common module API
(`keyword` / `semantic` / `hybrid` modes and filters including `sessionId`).

---

## Hybrid score (defaults)

- 0.40 semantic (local hash vectors; optional stored embedding boost)
- 0.25 lexical (token/tag overlap)
- 0.15 importance
- 0.05 confidence
- 0.15 recency (exponential half-life, default 30 days)

Selection: `limit=5`, `minScore=0.15`.

When an active workspace project is set, retrieval filters to
`project_id = active OR project_id IS NULL` and ranks project-scoped hits first
(see [Workspace-Awareness.md](./Workspace-Awareness.md) / ADR-0051).

Sync path: no live EmbeddingService.embed in the hot path (pipeline stays sync).

---

## Config

`memory.retrieval.*`

- `ATLAS_MEMORY_RETRIEVAL_LIMIT`
- `ATLAS_MEMORY_RETRIEVAL_MIN_SCORE`
- `ATLAS_MEMORY_RETRIEVAL_RECENCY_HALFLIFE_MS`

---

## API

```ts
import { createLongTermMemory, createMemorySearchApi } from "@atlas-ai/memory";

const ltm = createLongTermMemory(db.memories);
const hits = ltm.retrieve("change theme to dark", { limit: 5 });
// hits[0].score, hits[0].record

// Or the unified Search API (modes + tookMs):
const api = createMemorySearchApi(db.memories);
api.search({ query: "change theme to dark", mode: "hybrid" });
```

---

## CLI

```bash
pnpm atlas memory retrieve "change theme to dark"
pnpm atlas memory search "TypeScript" --mode keyword --tags lang
```

When the DB is enabled, CLI context loading uses `createRetriever` with retrieval config automatically.

---

## Out of scope

- Async pipeline for live embedding models
- File/KG search (Architecture/24)
- Auto-promote short-term → long-term
