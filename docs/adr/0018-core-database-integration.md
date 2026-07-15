# ADR-0018: Core database integration

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Atlas AI project team

## Context

Architecture/07 and /20 require local-first SQLite for settings, tools, tasks/executions, and preferences. The MVP plan includes `packages/database/`. Runtime data was previously in-memory only. Tech stack also mentions Prisma/Drizzle later; Phase 1 needs a working initialization + CRUD foundation first.

## Decision

1. Add `@atlas-ai/database` with SQLite via Node 22 `node:sqlite` (`DatabaseSync`) — no native addon.
2. Auto-initialize on `openAtlasDatabase()`: ensure directory, apply `SCHEMA_SQL`, stamp `schema_migrations`, seed system settings and preference placeholders.
3. Implement repositories for `system_config`, `user_preferences`, `tools`, `execution_history` / `task_executions`.
4. Wire the CLI to open the DB by default, sync tools, and record each pipeline run.
5. Defer ORM and vector extension to follow-ups.

## Consequences

### Positive

- Persistent local storage with zero external services.
- Tables align with Architecture/20 names for incremental expansion.
- Tests can use `:memory:`; files land under gitignored `.data/`.

### Negative / trade-offs

- `node:sqlite` is experimental (API may change; warn at runtime).
- No ORM migrations tool yet — versioned SQL string only.

### Follow-ups

- Optional Drizzle/Prisma layer.
- SQLite vector / semantic memory tables.
- Core pipeline optional `AtlasDatabase` injection (beyond CLI).
- Suppress or gate experimental SQLite warning in production builds.
