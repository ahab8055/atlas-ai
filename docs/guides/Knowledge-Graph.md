# Atlas AI — Knowledge Graph

Property-graph foundation for entities, relationships, traversal,
heuristic extraction, co-mention linking, and viz-ready export.

Related: [Architecture/23-Knowledge-Graph-Architecture.md](../Architecture/23-Knowledge-Graph-Architecture.md),
[Architecture/20-Database-Schema.md](../Architecture/20-Database-Schema.md),
[Context-Management.md](./Context-Management.md),
[ADR-0046](../adr/0046-knowledge-graph-data-model.md),
[ADR-0047](../adr/0047-knowledge-graph-entity-extraction.md),
[ADR-0048](../adr/0048-knowledge-graph-relationship-management.md),
[`@atlas-ai/knowledge`](../../packages/knowledge/).

---

## Goals

- Store entities and directed relationships consistently in SQLite
- Create / update / reinforce typed relationships over time
- Query neighbors and traverse with depth and type filters
- Extract entities and auto-link co-mentions from conversation text
- Deduplicate entities case-insensitively
- Export `GraphSnapshot` JSON for future visualization

---

## Package layout

```
packages/knowledge/src/
├── types.ts
├── store.ts
├── manager.ts
├── traverse.ts
├── snapshot.ts
├── context.ts
├── extraction/           # Heuristic extract + ingest
├── relationships/        # linkEntities, reinforce, co-mention
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

const project = graph.upsertEntity({ type: "project", name: "Atlas" });
const tech = graph.upsertEntity({ type: "technology", name: "TypeScript" });

graph.linkEntities({
  from: { id: project.id },
  to: { id: tech.id },
  type: "uses",
  source: "manual",
});

// Re-link reinforces weight + seenCount
graph.linkEntities({
  from: { type: "project", name: "Atlas" },
  to: { type: "technology", name: "typescript" },
  type: "uses",
});

const hops = graph.traverse({
  startId: project.id,
  maxDepth: 2,
  relationTypes: ["uses"],
});

const extracted = graph.extractAndStore(
  "I talked to Alice about project Atlas using React",
);
// extracted.linked includes co-mention edges
```

---

## Relationship management

| API                         | Behavior                                                               |
| --------------------------- | ---------------------------------------------------------------------- |
| `linkEntities`              | Create or reinforce edge; metadata `source`, `seenCount`, `lastSeenAt` |
| `updateRelationship`        | Patch type / weight / properties by id                                 |
| `getNeighbors` / `traverse` | Optional `direction` + `relationTypes`                                 |

### Config (`knowledge.relationships`)

| Key                 | Default | Meaning                        |
| ------------------- | ------- | ------------------------------ |
| `autoLinkOnExtract` | `true`  | Co-mention edges after extract |
| `reinforceOnLink`   | `true`  | Bump weight on re-link         |
| `reinforceStep`     | `0.05`  | Weight increment (cap 1)       |

Env: `ATLAS_KNOWLEDGE_AUTO_LINK_ON_EXTRACT`,
`ATLAS_KNOWLEDGE_REINFORCE_ON_LINK`, `ATLAS_KNOWLEDGE_REINFORCE_STEP`.

---

## Entity extraction

Deterministic heuristics (no LLM). Default `minConfidence` is **0.55**.
See ADR-0047. Co-mention linking after store is ADR-0048.

---

## CLI

```bash
atlas knowledge rel add --from <id> --to <id> --type uses [--weight 0.9]
atlas knowledge rel get <id>
atlas knowledge rel update <id> --weight 0.9
atlas knowledge link --from <id> --to <id> --type uses
atlas knowledge neighbors <id> --direction out --types uses
atlas knowledge traverse <id> --depth 2 --types uses,depends_on
atlas knowledge extract --store "project Atlas using TypeScript"
```

---

## Entity and relationship types

**Entities (known):** `project`, `person`, `technology`, `file`, `concept`,
`location`, `preference`, `company`, `application`.

**Relationships (known):** `part_of`, `depends_on`, `uses`, `related_to`,
`located_at`, `prefers`.

---

## Out of scope

- LLM NER / relationship inference
- Relationship history table
- Graph UI / Cypher
