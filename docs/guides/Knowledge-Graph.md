# Atlas AI — Knowledge Graph

Property-graph foundation for entities, relationships, traversal,
heuristic extraction, and viz-ready export.

Related: [Architecture/23-Knowledge-Graph-Architecture.md](../Architecture/23-Knowledge-Graph-Architecture.md),
[Architecture/20-Database-Schema.md](../Architecture/20-Database-Schema.md),
[Context-Management.md](./Context-Management.md),
[ADR-0046](../adr/0046-knowledge-graph-data-model.md),
[ADR-0047](../adr/0047-knowledge-graph-entity-extraction.md),
[`@atlas-ai/knowledge`](../../packages/knowledge/).

---

## Goals

- Store entities and directed relationships consistently in SQLite
- Query neighbors and traverse with depth limits
- Extract people, projects, companies, locations, files, technologies, and
  applications from conversation text
- Deduplicate entities case-insensitively
- Export `GraphSnapshot` JSON for future visualization
- Feed optional context snippets via `createKnowledgeProvider`

---

## Package layout

```
packages/knowledge/src/
├── types.ts              # Entity, Relationship, known types
├── store.ts              # GraphStore port
├── manager.ts            # KnowledgeGraphManager facade
├── traverse.ts           # Neighbors + BFS
├── snapshot.ts           # toGraphSnapshot
├── context.ts            # KnowledgeSnippet mapping + lexical retriever
├── extraction/           # Heuristic extract + ingest
├── errors.ts
└── providers/
    ├── in-memory.ts
    └── sqlite.ts
```

---

## Usage

```ts
import {
  createKnowledgeGraph,
  createSqliteGraphStore,
} from "@atlas-ai/knowledge";
import { openAtlasDatabase } from "@atlas-ai/database";

const db = openAtlasDatabase(":memory:");
const graph = createKnowledgeGraph(createSqliteGraphStore(db));

const project = graph.upsertEntity({
  type: "project",
  name: "Atlas",
});
const tech = graph.upsertEntity({
  type: "technology",
  name: "TypeScript",
});
graph.upsertRelationship({
  fromEntityId: project.id,
  toEntityId: tech.id,
  type: "uses",
});

const hops = graph.traverse({ startId: project.id, maxDepth: 2 });
const viz = graph.exportSnapshot({ startId: project.id, maxDepth: 2 });

const extracted = graph.extractAndStore(
  "I talked to Alice about project Atlas using React",
);
```

---

## Entity extraction

Deterministic heuristics (no LLM). Default `minConfidence` is **0.55**.

Stored metadata on upsert:

```json
{
  "source": "extraction",
  "confidence": 0.82,
  "evidence": "project Atlas",
  "extractedAt": "2026-07-18T..."
}
```

Duplicate detection: case-insensitive match on `(userId, type, name)`; first-seen
display casing is kept.

### Config (`knowledge.extraction`)

| Key                | Default | Meaning                                         |
| ------------------ | ------- | ----------------------------------------------- |
| `enabled`          | `true`  | Master switch                                   |
| `minConfidence`    | `0.55`  | Gate for candidates                             |
| `extractOnRequest` | `true`  | CLI auto-ingest after successful pipeline turns |

Env: `ATLAS_KNOWLEDGE_EXTRACTION_ENABLED`,
`ATLAS_KNOWLEDGE_EXTRACTION_MIN_CONFIDENCE`,
`ATLAS_KNOWLEDGE_EXTRACT_ON_REQUEST`.

---

## CLI

```bash
atlas knowledge entity add --type project --name Atlas
atlas knowledge entity list
atlas knowledge rel add --from <id> --to <id> --type uses
atlas knowledge neighbors <entityId>
atlas knowledge traverse <entityId> --depth 2
atlas knowledge export [--start <id>] [--depth 2]
atlas knowledge extract "I talked to Alice about project Atlas"
atlas knowledge extract --store "using TypeScript in VS Code"
```

---

## Entity and relationship types

**Entities (known):** `project`, `person`, `technology`, `file`, `concept`,
`location`, `preference`, `company`, `application` (custom strings allowed).

**Relationships (known):** `part_of`, `depends_on`, `uses`, `related_to`,
`located_at`, `prefers` (custom strings allowed).

---

## Visualization export

`exportSnapshot` returns:

```json
{
  "nodes": [
    { "id": "...", "label": "Atlas", "type": "project", "properties": {} }
  ],
  "edges": [{ "id": "...", "source": "...", "target": "...", "type": "uses" }]
}
```

No UI ships in this foundation; consumers can plug the JSON into a graph library
later.

---

## Out of scope

- LLM / embedding NER
- Auto relationship extraction
- File corpus bulk mining
- Graph UI
- Cypher / SPARQL
