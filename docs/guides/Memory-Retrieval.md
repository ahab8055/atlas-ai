# Atlas AI — Memory Retrieval

Hybrid ranking so Atlas recalls relevant long-term memories into context automatically.

Related: [Long-Term-Memory.md](./Long-Term-Memory.md), [Memory-Classification.md](./Memory-Classification.md), [Context-Management.md](./Context-Management.md), [Architecture/04-Memory-Architecture.md](../Architecture/04-Memory-Architecture.md), [ADR-0044](../adr/0044-memory-retrieval-engine.md), [`@atlas-ai/memory`](../../packages/memory/).

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
  → MemoryRetrievalEngine.retrieve()
  → hybrid score → top-K
  → createRetriever → LoadedContext.memories
  → plan goal note + response "Recalled memories"
```

---

## Hybrid score (defaults)

- 0.40 semantic (local hash vectors; optional stored embedding boost)
- 0.25 lexical (token/tag overlap)
- 0.15 importance
- 0.05 confidence
- 0.15 recency (exponential half-life, default 30 days)

Selection: `limit=5`, `minScore=0.15`.

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
import { createLongTermMemory } from "@atlas-ai/memory";

const ltm = createLongTermMemory(db.memories);
const hits = ltm.retrieve("change theme to dark", { limit: 5 });
// hits[0].score, hits[0].record
```

---

## CLI

```bash
pnpm atlas memory retrieve "change theme to dark"
```

When the DB is enabled, CLI context loading uses `createRetriever` with retrieval config automatically.

---

## Out of scope

- Async pipeline for live embedding models
- File/KG search (Architecture/24)
- Auto-promote short-term → long-term
