# ADR-0053: Context Builder

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** Atlas AI project team

## Context

`ContextManager` (ADR-0009) assembles provider contributions into
`LoadedContext`, but planner and response generators formatted a few fields
ad hoc. Architecture/24 §10 calls for a Context Builder that produces
AI-ready context with token limits, priority ranking, and duplicate removal.

## Decision

1. Add `buildContextPackage(LoadedContext) → ContextPackage` in
   `@atlas-ai/core` with ranked sections, char budget (~4 chars/token), and
   cross-section dedupe.
2. Attach `contextPackage` during `loadContext`; planner/response rebuild from
   current `LoadedContext` so late mutations still apply.
3. Priority: request → active tasks → project → preferences → memories →
   knowledge → conversation → system.
4. Config `context.builder` (`maxChars`, snippet/turn caps) with env overrides.
5. Pipeline passes builder options into load / plan / respond.

## Consequences

### Positive

- One structured package reaches planning and response before reasoning.
- Conversation and system state can surface, not only memory/KG/prefs.
- Budget prevents unbounded context growth.

### Negative / trade-offs

- Char heuristic, not a real tokenizer.
- No LLM summarization of long histories yet.

### Follow-ups

- Search-results provider into the builder.
- Optional joint memory+KG ranking.
- Desktop durable conversation sessions.
