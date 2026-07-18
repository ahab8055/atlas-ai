# ADR-0048: Knowledge graph relationship management

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** Atlas AI project team

## Context

ADR-0046 shipped directed edges with CRUD, neighbors, and BFS. ADR-0047 extracts
entities but does not connect them. Users need Atlas to understand how
information is connected, update relationships over time, and traverse related
entities efficiently. LLM linking would conflict with the offline-first
heuristic approach.

## Decision

1. Add `linkEntities` / reinforce helpers in `@atlas-ai/knowledge`: resolve
   endpoints by id or type+name; upsert edge; on re-link bump `weight`
   (`reinforceStep` default 0.05, cap 1), `seenCount`, and `lastSeenAt` in
   properties.
2. After `extractAndStore`, run heuristic **co-mention auto-link** (project→tech
   `uses`, person→company/project `related_to`, entity→location `located_at`,
   plus capped `related_to` fallbacks) when
   `knowledge.relationships.autoLinkOnExtract` is true.
3. Config `knowledge.relationships`: `autoLinkOnExtract`, `reinforceOnLink`,
   `reinforceStep`.
4. CLI: `rel get` / `rel update` / `link`, plus `--types` / `--direction` on
   `neighbors` and `traverse`.
5. Keep traversal as bounded in-process BFS (no graph DB).

## Consequences

### Positive

- Relationships update meaningfully when re-mentioned.
- Extraction populates a connected graph for smarter context hops.
- Multi-type edges and filters keep traversals focused.

### Negative / trade-offs

- Co-mention heuristics can over-link; LLM inference is a follow-up.
- No dedicated history table (metadata on the current edge only).

### Follow-ups

- Optional LLM relationship inference behind a feature flag.
- Weight decay scheduler.
- Relationship history / audit table if needed.
- [Knowledge-Graph.md](../guides/Knowledge-Graph.md)
