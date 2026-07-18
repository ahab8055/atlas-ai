# ADR-0049: Knowledge graph context retrieval

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** Atlas AI project team

## Context

ADR-0046 wired a lexical knowledge retriever that matched entity names and
loaded an unordered depth-1 neighborhood. Edge `weight` was unused, and
knowledge snippets never appeared in plan goals or user-facing responses
(only memories did). ADR-0046 deferred “rank hybrid search with graph hops.”
Full Architecture/24 keyword+vector+file hybrid search is still out of scope
for this slice.

## Decision

1. Add sync `KnowledgeRetrievalEngine` in `@atlas-ai/knowledge` (mirror
   memory retrieval): lexical seed match → neighbor expand → score → top-K.
2. Score with locked weights summing to 1: lexical **0.45**, graph hop/weight
   **0.30** (`edgeWeight * 1/(1+hop)`; hop 0 uses 1.0), recency **0.25**
   (half-life on `entity.updatedAt`, default 30 days).
3. Defaults: `limit` 8, `minScore` 0.2, `maxDepth` 2.
4. Public factory `createKnowledgeRetriever`; keep
   `createLexicalKnowledgeRetriever` as a back-compat alias. Manager
   exposes `retrieve` / `createRetriever`.
5. Config `knowledge.retrieval` + env
   `ATLAS_KNOWLEDGE_RETRIEVAL_*`.
6. Surface **Related knowledge** next to recalled memories in planner and
   response generator; optional `score` on `KnowledgeSnippet`. Do **not**
   fuse memory and graph into one ranked list.
7. CLI: `knowledge retrieve "query"`.

## Consequences

### Positive

- Related entities (via hops and edge weight) enter context automatically.
- Plan/response include structural knowledge alongside free-text memories.
- Scoring stays offline-first and deterministic.

### Negative / trade-offs

- Lexical seeds only (no vector entity search yet).
- Memory and knowledge remain separate lists (no joint score).

### Follow-ups

- Architecture/24 hybrid file/vector ranking.
- Optional LLM re-ranking.
- Fused memory+graph presentation if product requires it.
