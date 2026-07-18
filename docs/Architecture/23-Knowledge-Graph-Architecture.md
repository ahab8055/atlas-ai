# Atlas AI

## Technical Architecture Documentation

**Document:** 23-Knowledge-Graph-Architecture.md  
**Project Name:** Atlas AI (Codename)  
**Version:** 0.1 (Draft)  
**Status:** Draft  
**Author:** Ahab Latif  
**Last Updated:** July 18, 2026

---

# Knowledge Graph Architecture

## Purpose

This document defines the personal knowledge graph for Atlas AI: how entities and
relationships are modeled, stored, traversed, and exported for future
visualization.

The graph lets Atlas understand connections such as Project → Technology → Tool
without embedding that structure only in free-text memory.

Related: [Architecture/20-Database-Schema.md](./20-Database-Schema.md),
[Architecture/24-Search-and-Retrieval-Architecture.md](./24-Search-and-Retrieval-Architecture.md),
[guides/Knowledge-Graph.md](../guides/Knowledge-Graph.md),
[ADR-0046](../adr/0046-knowledge-graph-data-model.md),
[`@atlas-ai/knowledge`](../../packages/knowledge/).

---

# Design Goals

- Consistent entity and relationship storage (property graph in SQLite).
- Directed edges with optional weight and JSON properties.
- Depth-limited graph traversal for queries and context loading.
- Stable subgraph snapshot JSON for future visualization (no UI in this slice).
- Pluggable store (in-memory for tests, SQLite for persistence).

---

# Out of Scope (this foundation)

- Automatic NER / entity extraction from chat.
- Desktop or web graph visualization UI.
- Hybrid search ranking that blends graph hops with vectors (Architecture/24
  may consume the graph later).
- Cypher, SPARQL, or a dedicated graph database.

---

# Data Model

## Entity (node)

| Field        | Type     | Notes                                      |
| ------------ | -------- | ------------------------------------------ |
| `id`         | string   | UUID                                       |
| `userId`     | string   | Default `local`                            |
| `type`       | string   | Known set or custom (see below)            |
| `name`       | string   | Display / match key                        |
| `properties` | object   | Extensible JSON; prefer primitives for viz |
| `createdAt`  | ISO time |                                            |
| `updatedAt`  | ISO time |                                            |

**Consistency:** unique `(userId, type, name)`.

### Known entity types

`project` | `person` | `technology` | `file` | `concept` | `location` |
`preference` | (open string for custom types)

## Relationship (directed edge)

| Field          | Type     | Notes                             |
| -------------- | -------- | --------------------------------- |
| `id`           | string   | UUID                              |
| `userId`       | string   | Default `local`                   |
| `fromEntityId` | string   | FK → entity                       |
| `toEntityId`   | string   | FK → entity                       |
| `type`         | string   | Known set or custom               |
| `weight`       | number?  | Optional `0..1` for later ranking |
| `properties`   | object   | Extensible JSON                   |
| `createdAt`    | ISO time |                                   |
| `updatedAt`    | ISO time |                                   |

**Consistency:** unique `(userId, fromEntityId, toEntityId, type)`. Endpoints
must exist; deleting an entity cascades to incident edges.

### Known relationship types

`part_of` | `depends_on` | `uses` | `related_to` | `located_at` | `prefers` |
(open string for custom types)

---

# Storage

Tables in `@atlas-ai/database` (schema version ≥ 6):

- `entities`
- `relationships`

Domain logic lives in `@atlas-ai/knowledge` (`KnowledgeGraphManager` +
`GraphStore` port). Callers do not write SQL directly.

---

# Traversal and Queries

Supported operations:

| API              | Behavior                                                |
| ---------------- | ------------------------------------------------------- |
| `getEntity`      | By id                                                   |
| `listEntities`   | Filter by type / name substring / limit                 |
| `getNeighbors`   | 1-hop in / out / both, optional relation type filter    |
| `traverse`       | BFS from a start id, `maxDepth` (default 2), cycle-safe |
| `exportSnapshot` | Full graph or ego subgraph as viz-ready JSON            |

No declarative graph query language in MVP foundation.

---

# Visualization Contract

`GraphSnapshot` is the stable export shape for future D3 / Cytoscape / etc.:

```ts
{
  nodes: { id, label, type, properties }[];
  edges: { id, source, target, type, weight?, properties }[];
}
```

UI rendering is out of scope; exporters and CLI `export` produce this JSON only.

---

# Context Integration

`createKnowledgeProvider` in `@atlas-ai/core` accepts a `KnowledgeRetriever`.
When a graph is available, lexical name match on the request text loads a
shallow ego neighborhood and maps hits to `KnowledgeSnippet { id, label, content }`.

Default retriever remains empty when no database is configured.

---

# Package Boundaries

```
CLI / Context Manager
        ↓
KnowledgeGraphManager (@atlas-ai/knowledge)
        ↓
GraphStore (in-memory | sqlite)
        ↓
entities / relationships (@atlas-ai/database)
```

Memory (`@atlas-ai/memory`) remains free-text / typed memories; the knowledge
graph is structural. They may reference each other later but are not merged.

---

# Related documents

- [Architecture/20-Database-Schema.md](./20-Database-Schema.md)
- [Architecture/04-Memory-Architecture.md](./04-Memory-Architecture.md)
- [Architecture/22-AI-Orchestration-Architecture.md](./22-AI-Orchestration-Architecture.md)
- [guides/Knowledge-Graph.md](../guides/Knowledge-Graph.md)
- [ADR-0046](../adr/0046-knowledge-graph-data-model.md)
- [ADR-0009](../adr/0009-context-management.md)
