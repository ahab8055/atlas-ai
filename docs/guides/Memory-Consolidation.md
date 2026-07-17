# Atlas AI — Memory Consolidation

Heuristic merge of near-duplicate long-term memories, with history preserved and
conflicts flagged (Architecture/04 Memory Update Rules).

Related: [Long-Term-Memory.md](./Long-Term-Memory.md),
[Memory-Classification.md](./Memory-Classification.md),
[Memory-Retrieval.md](./Memory-Retrieval.md),
[Architecture/04-Memory-Architecture.md](../Architecture/04-Memory-Architecture.md),
[ADR-0045](../adr/0045-memory-consolidation-service.md),
[`@atlas-ai/memory`](../../packages/memory/).

---

## Goals

- Reduce duplicate rows
- Update survivors when facts change (e.g. VS Code → Cursor)
- Preserve prior content in `metadata.history`
- Flag contradictory preferences without deleting either row

---

## Flow

```
List / retrieve near neighbors
  → decide: merge | flag_conflict | skip
  → merge: update survivor + history + delete loser
  → conflict: set metadata.conflict.status=open on both
```

Also runs on `evaluateAndStore` when `consolidateOnStore` is true.

---

## Defaults

- `mergeMinScore`: 0.72
- `conflictMinScore`: 0.55
- `candidateLimit`: 10
- `consolidateOnStore`: true

Config: `memory.consolidation.*`

Env: `ATLAS_MEMORY_CONSOLIDATE_*`

---

## Metadata

- `history[]` — `{ at, content, fromId?, reason }`
- `consolidatedFrom[]` — merged memory ids
- `conflict` — `{ withId, status, detectedAt, note? }`

No schema migration (JSON `metadata` bag).

---

## CLI

```bash
pnpm atlas memory consolidate --dry-run
pnpm atlas memory consolidate --type semantic
pnpm atlas memory conflicts
```

---

## Out of scope

- LLM merge/summarization
- Dedicated history tables
- Background consolidation jobs
