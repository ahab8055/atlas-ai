# ADR-0050: User profile management

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** Atlas AI project team

## Context

Core ships an in-memory `PreferenceStore` used by the preferences context
provider and `environment.setup` planning. SQLite already has
`user_preferences` (ADR-0018) with seed rows, but the runtime never wired them
together. Responses ignored preferences. Product requirements ask Atlas to
store language, coding style, tools, AI prefs, productivity habits, and
communication style, and to use them across sessions.

## Decision

1. Add `@atlas-ai/profile` (depends on `@atlas-ai/database` only):
   `ProfileManager`, categorized known keys, duck-typed `asPreferenceStore()`,
   and heuristic `learnFromText` / `extractPreferences`.
2. Schema v7: `source`, `confidence`, `enabled` on `user_preferences`.
3. Config `profile.learning` (`enabled`, `learnOnRequest`, `minConfidence`).
4. CLI: `atlas profile` get/set/list/delete/enable/disable/learn; wire
   SQLite-backed preference store into `ContextManager` when DB is open;
   auto-learn after successful turns.
5. Planner and response surface a **User preferences** section (alongside
   memories/knowledge; not fused).
6. Keep semantic long-term memory for free-form preference _facts_; structured
   prefs remain the inspectable profile table.

## Consequences

### Positive

- Preferences persist across sessions and influence plan/response.
- Users can inspect, edit, and disable keys.
- Offline-first heuristic learning without LLM.

### Negative / trade-offs

- Heuristics can mis-map phrases; confidence + disable mitigate.
- No multi-user `users` table yet (`userId: "local"`).

### Follow-ups

- Optional promotion from LTM into structured prefs.
- LLM preference inference behind a feature flag.
- `users` table / multi-profile support.
