# ADR-0047: Knowledge graph entity extraction

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** Atlas AI project team

## Context

ADR-0046 shipped the property-graph data model and manual/CLI upserts. Users need
Atlas to recognize people, projects, companies, locations, files, technologies,
and applications from conversations and store them without creating case-variant
duplicates. LLM NER would add latency and offline friction.

## Decision

1. Add heuristic `extractEntities` / `extractAndStore` in `@atlas-ai/knowledge`
   (sync, no LLM)—patterned on memory classification.
2. Expand known entity types with `company` and `application`.
3. On upsert, resolve existing rows with **case-insensitive** `(userId, type,
name)` matching; keep first-seen display casing; merge extraction metadata
   (`source`, `confidence`, `evidence`, `extractedAt`).
4. Config `knowledge.extraction` (`enabled`, `minConfidence` 0.55,
   `extractOnRequest`).
5. CLI: `knowledge extract` / `knowledge extract --store`; when
   `extractOnRequest` is true, CLI `runCommand` auto-ingests after successful
   pipeline turns.
6. Do **not** add `@atlas-ai/knowledge` as a dependency of `@atlas-ai/core`.

## Consequences

### Positive

- Automatic structural organization from chat without a model round-trip.
- Reliable dedupe across casing variants.
- Same offline-first posture as memory classification.

### Negative / trade-offs

- Heuristics miss uncommon names and can false-positive; LLM NER is a follow-up.
- Auto relationship linking is not included.

### Follow-ups

- Optional LLM / embedding NER behind a feature flag.
- ~~Auto relationship extraction between co-mentioned entities.~~ Done
  (heuristic co-mention linking, ADR-0048).
- Fuzzy alias merge beyond case-insensitive exact names.
- [Knowledge-Graph.md](../guides/Knowledge-Graph.md)
