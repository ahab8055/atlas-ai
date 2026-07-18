# Atlas AI — Preference Learning

Observe repeated preference signals from conversation text, suggest structured
updates, and persist only after user approval.

Related: [User-Profile.md](./User-Profile.md),
[Database.md](./Database.md),
[ADR-0052](../adr/0052-preference-learning-engine.md),
[ADR-0050](../adr/0050-user-profile-management.md),
[`@atlas-ai/profile`](../../packages/profile/).

---

## Goals

- Count repeated heuristic extractions `(key, value)` sightings
- Open pending suggestions when thresholds are met
- Require approve/reject before writing `user_preferences`
- Keep manual `profile set` immediate (`source: manual`)

---

## Flow

```
User text / successful turn
  → extractPreferences
  → preference_observations++
  → count >= minOccurrences?
       → preference_suggestions (pending)
  → atlas profile approve | reject
```

Reject resets the observation count for that key/value so a fresh streak is
required before suggesting again.

---

## Config (`profile.learning`)

| Key               | Default | Meaning                            |
| ----------------- | ------- | ---------------------------------- |
| `enabled`         | `true`  | Master switch                      |
| `learnOnRequest`  | `true`  | Observe after successful CLI turns |
| `minConfidence`   | `0.55`  | Candidate floor                    |
| `minOccurrences`  | `2`     | Repeats before suggestion          |
| `requireApproval` | `true`  | Do not auto-write learned prefs    |
| `autoApply`       | `false` | Opt-in ADR-0050 silent write       |

Env: `ATLAS_PROFILE_LEARNING_ENABLED`, `ATLAS_PROFILE_LEARN_ON_REQUEST`,
`ATLAS_PROFILE_LEARN_MIN_CONFIDENCE`, `ATLAS_PROFILE_LEARN_MIN_OCCURRENCES`,
`ATLAS_PROFILE_LEARN_REQUIRE_APPROVAL`, `ATLAS_PROFILE_LEARN_AUTO_APPLY`.

When `autoApply` is true or `requireApproval` is false, learning writes
immediately with `source: learned`.

---

## CLI

```bash
atlas profile learn "I prefer Cursor"          # observe / maybe suggest
atlas profile learn "…" --apply                # immediate write
atlas profile suggestions
atlas profile approve <id|key>
atlas profile reject <id|key>
```

After a turn creates suggestions, Atlas prints:

`N preference suggestion(s) — atlas profile suggestions`

---

## Out of scope

- Full tool / workflow / OS action telemetry
- LLM preference inference
- LTM → structured preference promotion
- Desktop approve UI
