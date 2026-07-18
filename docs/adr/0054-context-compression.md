# ADR-0054: Context compression

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** Atlas AI project team

## Context

Context Builder (ADR-0053) packs a budgeted `ContextPackage` but drops older
conversation turns by hard windowing. Architecture/09 asks that old information
be summarized so important facts survive within model limits.

## Decision

1. Heuristic **extractive** compression (`compressConversation`) — no LLM.
2. When history exceeds `keepRecentTurns`, older user turns become
   `conversation_summary` bullets (preferences, decisions, project, notes);
   recent turns stay raw.
3. Section priority places `conversation_summary` after preferences and before
   memories so facts pack early.
4. Near-duplicate removal (Jaccard ≥ 0.85 / containment) across sections.
5. Config `context.compression.*` and `context.builder.scaleToModelContext`
   (scale `maxChars` from `ai.hardware.contextSize * 4 * 0.35`, floor 1024).

## Consequences

### Positive

- Important conversational facts survive truncation.
- Package stays within a fraction of the model context window.
- Sync, deterministic, no model round-trip.

### Negative / trade-offs

- Extractive heuristics miss nuanced facts.
- Not embedding-semantic redundancy.

### Follow-ups

- Optional LLM summarization behind a feature flag.
- Summarize-on-evict when STM drops oldest turns.
- Persist rolling summaries across process restarts.
