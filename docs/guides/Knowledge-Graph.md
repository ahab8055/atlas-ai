# Atlas AI — Knowledge Graph

Property-graph foundation for entities, relationships, traversal, and
viz-ready export.

Related: [Architecture/23-Knowledge-Graph-Architecture.md](../Architecture/23-Knowledge-Graph-Architecture.md),
[Architecture/20-Database-Schema.md](../Architecture/20-Database-Schema.md),
[Context-Management.md](./Context-Management.md),
[ADR-0046](../adr/0046-knowledge-graph-data-model.md),
[`@atlas-ai/knowledge`](../../packages/knowledge/).

---

## Goals

- Store entities and directed relationships consistently in SQLite
- Query neighbors and traverse with depth limits
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
```

---

## CLI

```bash
atlas knowledge entity add --type project --name Atlas
atlas knowledge entity list
atlas knowledge rel add --from <id> --to <id> --type uses
atlas knowledge neighbors <entityId>
atlas knowledge traverse <entityId> --depth 2
atlas knowledge export [--start <id>] [--depth 2]
```

---

## Entity and relationship types

**Entities (known):** `project`, `person`, `technology`, `file`, `concept`,
`location`, `preference` (custom strings allowed).

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

- Automatic entity extraction
- Graph UI
- Cypher / SPARQL
