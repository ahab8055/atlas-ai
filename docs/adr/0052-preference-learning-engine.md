# ADR-0052: Preference learning engine

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** Atlas AI project team

## Context

ADR-0050 heuristic `learnFromText` auto-wrote preferences after successful
CLI turns. Product acceptance requires Atlas to **observe** repeated signals,
**suggest** preference updates, and persist only after **user approval** so
users retain full control over learned behavior.

## Decision

1. Schema **v9**: `preference_observations` (key/value counts) and
   `preference_suggestions` (`pending` | `approved` | `rejected`).
2. Extend `@atlas-ai/profile`: `observeFromText`, `listSuggestions`,
   `approveSuggestion`, `rejectSuggestion`. Default path is observe → suggest;
   `learnFromText` with `autoApply` retains ADR-0050 silent write.
3. Config `profile.learning`: `minOccurrences` (default 2),
   `requireApproval` (default true), `autoApply` (default false).
4. CLI: `atlas profile suggestions|approve|reject`; `profile learn` observes
   by default (`--apply` for immediate write); post-turn learning enqueues
   suggestions and prints a one-line notice.
5. Observation source for MVP: conversation-text heuristics only (not a full
   tool/OS action bus).

## Consequences

### Positive

- Useful recommendations without silent preference mutation.
- Users approve/reject; reject resets the observation streak.
- Opt-in `autoApply` preserves prior behavior when desired.

### Negative / trade-offs

- Preferences take ≥ `minOccurrences` sightings before suggesting.
- Text heuristics remain limited vs LLM / action telemetry.

### Follow-ups

- LTM → structured preference promotion.
- Optional LLM inference behind a feature flag.
- Desktop approve UI.
