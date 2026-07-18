# Atlas AI — Long-Term Memory

Persistent memories across sessions so Atlas does not need to be told the same
facts repeatedly.

Related: [Memory-Architecture.md](./Memory-Architecture.md),
[Short-Term-Memory.md](./Short-Term-Memory.md),
[Memory-Classification.md](./Memory-Classification.md),
[Memory-Retrieval.md](./Memory-Retrieval.md),
[Memory-Search.md](./Memory-Search.md),
[Memory-Consolidation.md](./Memory-Consolidation.md),
[Context-Management.md](./Context-Management.md),
[Database.md](./Database.md),
[Architecture/04-Memory-Architecture.md](../Architecture/04-Memory-Architecture.md),
[Architecture/20-Database-Schema.md](../Architecture/20-Database-Schema.md),
[ADR-0042](../adr/0042-long-term-memory.md),
[ADR-0043](../adr/0043-memory-classification-engine.md),
[ADR-0044](../adr/0044-memory-retrieval-engine.md),
[ADR-0045](../adr/0045-memory-consolidation-service.md),
[ADR-0055](../adr/0055-memory-search-api.md),
[`@atlas-ai/memory`](../../packages/memory/), [`@atlas-ai/database`](../../packages/database/).

---

## Types

Long-term only (SQLite):

- `episodic` — past interactions / incidents
- `semantic` — preferences, facts, project knowledge
- `procedural` — repeated workflows

Working / short-term conversation turns stay in [Short-Term-Memory.md](./Short-Term-Memory.md).

---

## Persistence

Tables `memories` + `memory_tags` (schema v5). Opened via `openAtlasDatabase`.

```ts
import { openAtlasDatabase } from "@atlas-ai/database";
import { createLongTermMemory } from "@atlas-ai/memory";

const db = openAtlasDatabase();
const ltm = createLongTermMemory(db.memories);

ltm.store({
  type: "semantic",
  content: "Preferred editor is Cursor",
  importance: 0.9,
  tags: ["preference"],
});

const hits = ltm.search("editor", { limit: 5, mode: "hybrid" });
```

Relevance ranking uses the [Memory Search API](./Memory-Search.md): hybrid
lexical + in-process hash semantic similarity + importance/confidence/recency
(no live EmbeddingService in the hot path). Optional stored embedding vectors
can boost the semantic component.

---

## CLI

Requires the database (not `--no-db`), except `classify`:

```bash
pnpm atlas memory classify "I like dark mode interfaces."
pnpm atlas memory add --type semantic "Prefers TypeScript" --importance 0.9
pnpm atlas memory add --classify "I prefer TypeScript"
pnpm atlas memory list --type semantic
pnpm atlas memory search "TypeScript"
pnpm atlas memory retrieve "change theme to dark"
pnpm atlas memory consolidate --type semantic
pnpm atlas memory conflicts
pnpm atlas memory get <id>
pnpm atlas memory update <id> --content "Prefers TypeScript strictly"
pnpm atlas memory delete <id>
pnpm atlas memory purge-expired
```

Search/retrieve also accept `--mode keyword|semantic|hybrid`, `--tags a,b`,
and `--session <id>` — see [Memory-Search.md](./Memory-Search.md).

Use `--classify` to run the importance gate before store; see
[Memory-Classification.md](./Memory-Classification.md). Ranking/retrieval:
[Memory-Retrieval.md](./Memory-Retrieval.md).

When the CLI opens SQLite, context loading injects top relevant memories into
`LoadedContext.memories`.

---

## Out of scope

- Auto-promotion from short-term
- Vector embedding on every write
- Desktop Memory UI / cloud sync
