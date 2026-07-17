# ADR-0043: Memory classification engine

- **Status:** Accepted
- **Date:** 2026-07-17
- **Deciders:** Atlas AI project team

## Context

Architecture/04 requires an importance gate so Atlas does not remember ephemeral
chatter (e.g. “coffee tastes good”) while retaining preferences and explicit
“remember …” requests. ADR-0042 persisted importance/confidence on long-term
rows but left classification to callers.

## Decision

1. Add a deterministic heuristic classifier in `@atlas-ai/memory`
   (`classifyMemory`) with actions `discard` | `short_term` | `store_long_term`.
2. Defaults: `minImportanceToStore=0.45`, `minConfidenceToStore=0.35`;
   explicit remember → importance ≥ 0.9, confidence ≥ 0.85, permanent.
3. `LongTermMemory.evaluateAndStore` runs classify then stores only when
   `store_long_term`; keep manual `store()` as an explicit bypass.
4. Optional `metadata.expiresAt` + `purgeExpiredMemories` for TTL cleanup.
5. Config under `memory.classification` (+ `ATLAS_MEMORY_CLASSIFY_*` env);
   CLI: `memory classify`, `memory add --classify`, `memory purge-expired`.

## Consequences

### Positive

- Low-value candidates are discarded before SQLite write.
- Important preferences and remember-requests are retained with scores.
- Classification is testable and offline-friendly (no LLM dependency).

### Negative / trade-offs

- Heuristics can mis-label edge cases; LLM classification is a follow-up.
- Temporary action does not auto-buffer into short-term conversation store
  (caller may do so later).

### Follow-ups

- Hook pipeline / short-term promotion into `evaluateAndStore`.
- Optional LLM assist for ambiguous candidates.
- [Memory-Classification.md](../guides/Memory-Classification.md)
