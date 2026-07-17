# ADR-0042: Long-term memory

- **Status:** Accepted
- **Date:** 2026-07-17
- **Deciders:** Atlas AI project team

## Context

Users need important facts and preferences to survive restarts. ADR-0040 provided
in-memory typed stores; ADR-0041 covered short-term conversation buffers.
Architecture/20 defines `memories` / `memory_tags` tables that were not yet
implemented. Context `createMemoryProvider` still returned empty by default.

## Decision

1. Add SQLite schema v5: `memories` + `memory_tags` and `MemoriesRepository`.
2. Persist only long-term types (`episodic` | `semantic` | `procedural`) via
   `SqliteMemoryProvider` + `createPersistentMemoryManager`.
3. Expose sync `LongTermMemory` facade for CRUD and relevance-ranked `search`
   (token + importance + recency).
4. Wire CLI: when DB enabled, inject `createMemoryProvider(ltm.createRetriever())`
   into `ContextManager`; add `atlas memory` management commands.
5. Keep `--no-db` without long-term persistence (empty memory provider).

## Consequences

### Positive

- Memories persist across restarts.
- Relevant memories appear in context for follow-ups.
- Users can list/add/update/delete/search via CLI.

### Negative / trade-offs

- Relevance is lexical, not embedding-based (follow-up).
- No automatic capture from conversations yet.

### Follow-ups

- Optional embedding boost using `collection=memory`.
- Promote selected short-term turns into long-term.
- Desktop Memory viewer UI.
