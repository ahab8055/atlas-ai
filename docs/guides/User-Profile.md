# Atlas AI — User Profile

Structured, categorized user preferences with SQLite persistence, context
injection, and optional preference learning (observe → suggest → approve).

Related: [Context-Management.md](./Context-Management.md),
[Preference-Learning.md](./Preference-Learning.md),
[Database.md](./Database.md),
[Architecture/20-Database-Schema.md](../Architecture/20-Database-Schema.md),
[ADR-0050](../adr/0050-user-profile-management.md),
[ADR-0052](../adr/0052-preference-learning-engine.md),
[`@atlas-ai/profile`](../../packages/profile/).

---

## Goals

- Persist preferred language, coding style, tools, AI prefs, productivity
  habits, and communication style
- Load preferences into `LoadedContext` every request
- Influence planner goals and response notes
- Allow list / get / set / delete / enable / disable
- Learn from conversation text via suggestions (see
  [Preference-Learning.md](./Preference-Learning.md))

---

## Package layout

```
packages/profile/src/
├── types.ts           # categories, PROFILE_KEYS, snapshot
├── manager.ts         # ProfileManager
├── store-adapter.ts   # duck-typed PreferenceStore
├── learning/          # extract / observe / suggest
└── index.ts
```

---

## Usage

```ts
import { createProfileManager } from "@atlas-ai/profile";
import { openAtlasDatabase } from "@atlas-ai/database";

const db = openAtlasDatabase(":memory:");
const profile = createProfileManager(db.userPreferences, {
  observations: db.preferenceObservations,
  suggestions: db.preferenceSuggestions,
});

profile.set("preferredEditor", "Cursor", { category: "tools" });
profile.observeFromText("I prefer concise answers");
// after enough occurrences:
// profile.approveSuggestion(id)

const store = profile.asPreferenceStore();
// pass store into ContextManager as preferenceStore
```

### Categories / keys

| Category        | Keys                                     |
| --------------- | ---------------------------------------- |
| `language`      | `preferred_language`                     |
| `coding`        | `coding_style`, `coding_language`        |
| `tools`         | `preferred_editor`, `preferred_terminal` |
| `ai`            | `ai_verbosity`, `ai_explanation_depth`   |
| `productivity`  | `productivity_habits`                    |
| `communication` | `communication_style`, `response_length` |
| `appearance`    | `theme`                                  |

Context uses camelCase (`preferredEditor`). DB stores snake_case.

Learning config lives under `profile.learning` — see
[Preference-Learning.md](./Preference-Learning.md).

---

## CLI

```bash
atlas profile list [--category coding]
atlas profile get preferred_editor
atlas profile set preferred_editor Cursor --category tools
atlas profile disable theme
atlas profile enable theme
atlas profile delete theme
atlas profile learn "I prefer Cursor and concise answers"
atlas profile suggestions
atlas profile approve <id|key>
atlas profile reject <id|key>
```

---

## Dual layer with memory

- **Structured prefs** (`user_preferences`) — inspectable profile keys.
- **Semantic memories** — free-form facts (“User prefers dark mode”).

They stay separate; both can appear in context.

---

## Out of scope

- Cloud sync / multi-user auth
- LLM preference inference
- Promoting LTM rows into prefs automatically
