# ADR-0046: Knowledge graph data model

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** Atlas AI project team

## Context

Architecture indexes doc 23 as Knowledge Graph, but the file previously held
Computer Interaction content. Context management (ADR-0009) already exposes
`createKnowledgeProvider`, and Architecture/20 lists knowledge graph as future
SQLite expansion. Developers need a durable property-graph foundation so Atlas
can store entities, relationships, and support graph queries before any UI or
auto-extraction exists.

## Decision

1. Add `@atlas-ai/knowledge` with entity/relationship types,
   `KnowledgeGraphManager`, and a sync `GraphStore` port.
2. Persist as a **property graph in SQLite** (`entities`, `relationships`) at
   schema version 6 — directed edges, optional weight, JSON properties.
3. Enforce uniqueness: `(user_id, type, name)` for entities;
   `(user_id, from_entity_id, to_entity_id, type)` for relationships.
4. Support **BFS traversal** (depth-limited, cycle-safe) and neighbor queries —
   no Cypher/SPARQL.
5. Export **`GraphSnapshot`** (`nodes` + `edges`) for future visualization;
   no graph UI in this ADR.
6. Wire an optional lexical retriever into `createKnowledgeProvider` when a
   store is available; default remains empty.
7. Move Computer Interaction architecture to document **26**; rewrite **23** as
   Knowledge Graph Architecture.

## Consequences

### Positive

- Consistent storage and query APIs for structural knowledge.
- Viz-ready export without locking to a UI library.
- Aligns with ADR-0009 knowledge port and Architecture/20 expansion.

### Negative / trade-offs

- BFS over SQLite is fine for personal-scale graphs; not a graph DB.
- Entity extraction and hybrid search ranking remain follow-ups.

### Follow-ups

- Auto-extract entities from conversation / files.
- Rank hybrid search with graph hops (Architecture/24).
- Desktop graph visualization consuming `GraphSnapshot`.
- [Knowledge-Graph.md](../guides/Knowledge-Graph.md)
