# Atlas AI — Context Management

Collects relevant context **before** planning and execution, then builds a
ranked, budgeted **ContextPackage** so plans and responses receive the right
information.

Related: [Request-Pipeline.md](./Request-Pipeline.md),
[Intent-Detection.md](./Intent-Detection.md),
[Architecture/22-AI-Orchestration-Architecture.md](../Architecture/22-AI-Orchestration-Architecture.md),
[Architecture/24-Search-and-Retrieval-Architecture.md](../Architecture/24-Search-and-Retrieval-Architecture.md)
(Context Builder),
[Memory-Retrieval.md](./Memory-Retrieval.md),
[Knowledge-Graph.md](./Knowledge-Graph.md),
[User-Profile.md](./User-Profile.md),
[Workspace-Awareness.md](./Workspace-Awareness.md),
[ADR-0009](../adr/0009-context-management.md),
[ADR-0053](../adr/0053-context-builder.md),
[`@atlas-ai/core`](../../packages/core/).

---

## When it runs

```
Intent Detection
      ↓
Context Loading   ← ContextManager.load(...) → LoadedContext
      ↓
Context Builder   ← buildContextPackage(...) → ContextPackage
      ↓
Planning → Execution → Response  (consume package notes)
      ↓
recordAssistant(...)  (conversation continuity)
```

---

## Context structure (`LoadedContext`)

| Field                 | Source                                | MVP                                                                                                                                      |
| --------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `conversation`        | Current session turns                 | Short-term buffer (window + TTL); see [Short-Term-Memory.md](./Short-Term-Memory.md)                                                     |
| `preferences`         | User preferences                      | SQLite via `@atlas-ai/profile` when DB enabled; else in-memory defaults. See [User-Profile.md](./User-Profile.md) / ADR-0050             |
| `activeTasks`         | Active / working tasks                | In-memory store                                                                                                                          |
| `systemState`         | Runtime / platform / input source     | Live `process` info                                                                                                                      |
| `project`             | Active workspace project              | Detected via `@atlas-ai/workspace` when DB enabled; see [Workspace-Awareness.md](./Workspace-Awareness.md) / ADR-0051                    |
| `memories`            | `@atlas-ai/memory` long-term (SQLite) | Hybrid retrieval when DB enabled; see [Memory-Retrieval.md](./Memory-Retrieval.md)                                                       |
| `knowledge`           | Personal knowledge graph              | Ranked neighbors (lexical + hop + weight + recency) when DB wired; see [Knowledge-Graph.md](./Knowledge-Graph.md) / ADR-0049; else empty |
| `sources`             | Provider ids that ran                 | Always listed                                                                                                                            |
| `conversationSummary` | Compact log/plan string               | Derived from turns                                                                                                                       |
| `contextPackage`      | Context Builder output                | Ranked / deduped / budgeted sections + notes (ADR-0053)                                                                                  |

---

## Context Builder

`buildContextPackage` turns `LoadedContext` into a `ContextPackage`:

- **Priority:** request → active tasks → project → preferences → memories →
  knowledge → conversation → system
- **Budget:** `maxChars` (default 4000; ~1k tokens at 4 chars/token)
- **Dedup:** skip lines already included from an earlier section
- **Outputs:** `text`, `planNotes` (pipe-join into plan goals),
  `responseNotes` (multi-line response blocks)

### Config (`context.builder`)

| Key                    | Default | Meaning                             |
| ---------------------- | ------- | ----------------------------------- |
| `maxChars`             | `4000`  | Package character budget            |
| `maxMemorySnippets`    | `5`     | Memory line cap                     |
| `maxKnowledgeSnippets` | `5`     | Knowledge line cap                  |
| `maxConversationTurns` | `6`     | Prior turns (excludes live request) |

Env: `ATLAS_CONTEXT_MAX_CHARS`, `ATLAS_CONTEXT_MAX_MEMORY_SNIPPETS`,
`ATLAS_CONTEXT_MAX_KNOWLEDGE_SNIPPETS`, `ATLAS_CONTEXT_MAX_CONVERSATION_TURNS`.

```ts
import { buildContextPackage, loadContext } from "@atlas-ai/core";

const context = loadContext(request, intent, { manager });
const pkg = context.contextPackage ?? buildContextPackage(context);
```

---

## Providers

Pluggable `ContextProvider` modules (same idea as intent registry):

- `conversation` · `preferences` · `active_tasks` · `system` · `project` · `memory` · `knowledge`

```ts
import {
  ContextManager,
  createMemoryProvider,
  handleRequest,
} from "@atlas-ai/core";

const contextManager = new ContextManager({
  providers: [
    createMemoryProvider(() => [
      {
        id: "pref-dark",
        content: "User prefers dark mode",
        kind: "semantic",
        score: 0.9,
      },
    ]),
  ],
});

const result = handleRequest(
  { source: "cli", rawInput: "status", sessionId: "s1" },
  { contextManager },
);
```

`@atlas-ai/memory` provides short-term conversation buffers and long-term SQLite
memories ([Short-Term-Memory.md](./Short-Term-Memory.md),
[Long-Term-Memory.md](./Long-Term-Memory.md)). When the CLI opens the database,
relevant long-term memories are injected into context via `createMemoryProvider`.

---

## Conversation continuity

Same `sessionId` reuses turns. The pipeline appends the user utterance during load and the assistant reply after response generation. Default store is `ShortTermMemory` (configurable `maxEntries` / `ttlMs`).

---

## Commands

```bash
pnpm core:build
pnpm test   # includes packages/core/src/context tests
```
