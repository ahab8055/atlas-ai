# Atlas AI — Long-Term Memory

Persistent memories across sessions so Atlas does not need to be told the same
facts repeatedly.

Related: [Memory-Architecture.md](./Memory-Architecture.md),
[Short-Term-Memory.md](./Short-Term-Memory.md),
[Context-Management.md](./Context-Management.md),
[Database.md](./Database.md),
[Architecture/04-Memory-Architecture.md](../Architecture/04-Memory-Architecture.md),
[Architecture/20-Database-Schema.md](../Architecture/20-Database-Schema.md),
[ADR-0042](../adr/0042-long-term-memory.md),
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

const hits = ltm.search("editor", { limit: 5 });
```

Relevance ranking: tokenized content matches + importance + recency (no embedding
required).

---

## CLI

Requires the database (not `--no-db`):

```bash
pnpm atlas memory add --type semantic "Prefers TypeScript" --importance 0.9
pnpm atlas memory list --type semantic
pnpm atlas memory search "TypeScript"
pnpm atlas memory get <id>
pnpm atlas memory update <id> --content "Prefers TypeScript strictly"
pnpm atlas memory delete <id>
```

When the CLI opens SQLite, context loading injects top relevant memories into
`LoadedContext.memories`.

---

## Out of scope

- Auto-promotion from short-term
- Vector embedding on every write
- Desktop Memory UI / cloud sync
