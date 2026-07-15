# Atlas AI — Intent Detection

Classifies user commands into structured intents for planning and tools.

Related: [Request-Pipeline.md](./Request-Pipeline.md), [Architecture/02-Component-Architecture.md](../Architecture/02-Component-Architecture.md) (Intent Processor), [Architecture/22-AI-Orchestration-Architecture.md](../Architecture/22-AI-Orchestration-Architecture.md), [ADR-0008](../adr/0008-intent-detection-registry.md), [`@atlas-ai/core`](../../packages/core/).

---

## Output shape

Every detection returns a `DetectedIntent`:

| Field          | Meaning                                                  |
| -------------- | -------------------------------------------------------- |
| `name`         | Stable id (`application.open`, `file.search`, …)         |
| `category`     | Routing bucket (`application_control`, `file_search`, …) |
| `goal`         | Short user-goal description                              |
| `parameters`   | Extracted slots (`application`, `keyword`, `target`, …)  |
| `confidence`   | 0–1 match score                                          |
| `capabilities` | Security / tool capabilities needed                      |
| `complexity`   | `low` \| `medium` \| `high`                              |
| `known`        | `false` for graceful unknown handling                    |

Example (Architecture Intent Processor style):

```
Input:  Find my API documentation
Intent: file.search (category=file_search)
Params: keyword="API documentation"
```

---

## Built-in examples

| Command               | Intent             | Category              | Parameters              |
| --------------------- | ------------------ | --------------------- | ----------------------- |
| Open VS Code          | `application.open` | `application_control` | `application=VS Code`   |
| Find my project files | `file.search`      | `file_search`         | `keyword=project files` |
| Explain this code     | `code.analyze`     | `code_analysis`       | `target=code`           |
| status / ping         | `system.status`    | `system`              | —                       |
| (unrecognized)        | `unknown`          | `unknown`             | `text=…`                |

---

## Extending

```ts
import { registerIntent, detectIntent } from "@atlas-ai/core";

registerIntent({
  name: "calendar.check",
  category: "conversation",
  goal: "Check calendar",
  capabilities: [],
  complexity: "low",
  priority: 60,
  match(normalizedText, originalText) {
    if (!normalizedText.startsWith("check calendar")) return null;
    return { confidence: 0.9, parameters: { text: originalText } };
  },
});
```

Or pass a custom `IntentRegistry` into `detectIntent(request, { registry })` without mutating globals.

---

## Pipeline behavior

- Logs `IntentDetected` with category, goal, parameters, and `known`.
- Unknown intents still flow through plan → execute → respond with a helpful message.
- Capability-bearing intents (app open, file search, code analysis) go through `@atlas-ai/security` at execution.

```bash
pnpm atlas "Open VS Code"
pnpm atlas "Find my project files"
pnpm atlas "Explain this code"
```
