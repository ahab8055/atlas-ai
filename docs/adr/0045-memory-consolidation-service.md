# ADR-0045: Memory consolidation service

- **Status:** Accepted
- **Date:** 2026-07-17
- **Deciders:** Atlas AI project team

## Context

Architecture/04 Memory Update Rules require newer facts to supersede older ones
(e.g. preferred editor VS Code → Cursor) and lifecycle Updated → Archived →
Deleted. Users also accumulate near-duplicate preference rows. ADR-0042–0044
provided store/update/retrieve but not automatic dedupe or conflict flagging.

## Decision

1. Add heuristic `consolidateMemories` / `consolidateAgainstText` in
   `@atlas-ai/memory` (sync, no LLM).
2. Near-duplicates (`mergeMinScore` 0.72) merge into a survivor; history and
   `consolidatedFrom` live in `metadata`; losers are deleted.
3. Contradictions (e.g. dark vs light theme) keep both rows and set
   `metadata.conflict.status=open`.
4. Editor preference changes supersede via merge (Update Rules), not conflict.
5. `evaluateAndStore` consolidates on store when configured.
6. `LongTermMemory.update` deep-merges metadata so history is not wiped.
7. Config `memory.consolidation` + CLI `consolidate` / `conflicts`.

## Consequences

### Positive

- Duplicate memories are reduced.
- Fact updates stay consistent with preserved history.
- Conflicts are visible and auditable.

### Negative / trade-offs

- Heuristics can misclassify edge cases; LLM merge is a follow-up.
- History is metadata-only (no dedicated table).

### Follow-ups

- Resolve/ignore conflict CLI actions.
- Optional scheduled consolidation job.
- [Memory-Consolidation.md](../guides/Memory-Consolidation.md)
