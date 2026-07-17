# ADR-0041: Short-term memory

- **Status:** Accepted
- **Date:** 2026-07-17
- **Deciders:** Atlas AI project team

## Context

Users need Atlas to remember recent conversation turns for natural follow-ups.
Core already had `InMemoryConversationStore` with a hardcoded 50-turn cap and no
TTL. ADR-0040 introduced `@atlas-ai/memory` working memory without a
conversation-window policy.

## Decision

1. Add `ShortTermMemory` in `@atlas-ai/memory` with configurable `maxEntries`
   and `ttlMs`, session isolation, and `toConversationStore()` for core.
2. Optionally mirror turns into working MemoryRecords when a `MemoryManager` is
   provided.
3. Extend `InMemoryConversationStore` with the same window/TTL options for tests.
4. Default `ContextManager` to ShortTermMemory-backed store; accept
   `shortTermOptions`.
5. Add `config.memory.shortTerm` (+ env overrides); CLI wires config into
   ShortTermMemory.

## Consequences

### Positive

- Follow-ups use a bounded, auto-expiring buffer.
- Window size and TTL are configurable without code changes.
- Conversation store remains sync; memory package owns the policy.

### Negative / trade-offs

- Process-local only until a durable provider exists.
- Working-memory mirror is best-effort (async).

### Follow-ups

- Persist short-term buffer across restarts when appropriate.
- Promote selected turns into episodic/semantic memory.
