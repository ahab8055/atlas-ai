# Atlas AI — Memory Search API

Unified entry for keyword, semantic, and hybrid long-term memory search so every
module retrieves through one interface.

Related: [Memory-Retrieval.md](./Memory-Retrieval.md),
[Long-Term-Memory.md](./Long-Term-Memory.md),
[CLI.md](./CLI.md),
[ADR-0055](../adr/0055-memory-search-api.md),
[ADR-0044](../adr/0044-memory-retrieval-engine.md),
[`@atlas-ai/memory`](../../packages/memory/).

---

## Goals

- One sync facade: `MemorySearchApi.search` / `LongTermMemory.searchMemories`
- Explicit modes: `keyword` | `semantic` | `hybrid` (default)
- Filters: `type`, `tags`, `sessionId`, `userId`, `projectId`, `limit`, `minScore`
- Keep latency low (in-process; under 500ms for small corpora)

---

## Modes → weight presets

| Mode       | Lexical | Semantic | Notes                                            |
| ---------- | ------- | -------- | ------------------------------------------------ |
| `keyword`  | 0.85    | 0        | Token/tag overlap dominates                      |
| `semantic` | 0       | 0.85     | Hash vectors (+ optional stored embedding boost) |
| `hybrid`   | 0.25    | 0.40     | Existing `DEFAULT_RETRIEVAL_WEIGHTS`             |

Importance / confidence / recency stay small in keyword and semantic modes.
Semantic mode does **not** call live EmbeddingService in the hot path (ADR-0044).

---

## API

```ts
import { createMemorySearchApi, createLongTermMemory } from "@atlas-ai/memory";

const api = createMemorySearchApi(db.memories);
const result = api.search({
  query: "TypeScript preference",
  mode: "keyword",
  tags: ["lang"],
  sessionId: "sess-a",
  projectId: activeProjectId,
  limit: 5,
  minScore: 0.05,
});
// result.hits, result.mode, result.tookMs

const ltm = createLongTermMemory(db.memories);
ltm.searchMemories({ query: "dark mode", mode: "hybrid" });
ltm.search("dark mode", { mode: "semantic", sessionId: "s1" });
ltm.retrieve("dark mode", { mode: "keyword", tags: ["ui"] });
```

`LongTermMemory.search` / `retrieve` / `createRetriever` delegate to the same
Search API. Core continues to use `createRetriever` (optional `mode`,
`sessionId`).

---

## CLI

```bash
pnpm atlas memory search "TypeScript" --mode keyword --tags lang --session sess-a
pnpm atlas memory retrieve "change theme to dark" --mode hybrid --limit 5
```

Flags: `--mode keyword|semantic|hybrid`, `--type`, `--tags a,b`, `--session`,
`--limit`. Active workspace project still scopes via `projectIdOrUnscoped`.

---

## Out of scope

- HTTP `POST /memories/search`
- Cross-source Retrieval Orchestrator (files + KG + memory)
- Live EmbeddingService / vector DB / FTS5
- Unifying knowledge search into the same class
