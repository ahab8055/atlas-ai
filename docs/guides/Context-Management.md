# Atlas AI — Context Management

Collects relevant context **before** planning and execution so responses can be personalized and accurate.

Related: [Request-Pipeline.md](./Request-Pipeline.md), [Intent-Detection.md](./Intent-Detection.md), [Architecture/22-AI-Orchestration-Architecture.md](../Architecture/22-AI-Orchestration-Architecture.md) (Context Manager), [Architecture/04-Memory-Architecture.md](../Architecture/04-Memory-Architecture.md), [ADR-0009](../adr/0009-context-management.md), [`@atlas-ai/core`](../../packages/core/).

---

## When it runs

```
Intent Detection
      ↓
Context Loading   ← ContextManager.load(...)
      ↓
Planning → Execution → Response
      ↓
recordAssistant(...)  (conversation continuity)
```

---

## Context structure (`LoadedContext`)

| Field                 | Source                            | MVP                                   |
| --------------------- | --------------------------------- | ------------------------------------- |
| `conversation`        | Current session turns             | In-memory store                       |
| `preferences`         | User preferences                  | Defaults (`preferredEditor: VS Code`) |
| `activeTasks`         | Active / working tasks            | In-memory store                       |
| `systemState`         | Runtime / platform / input source | Live `process` info                   |
| `project`             | Project context                   | Stub (`Atlas AI`)                     |
| `memories`            | Future `@atlas-ai/memory`         | Empty + swappable provider            |
| `knowledge`           | Future knowledge graph            | Empty + swappable provider            |
| `sources`             | Provider ids that ran             | Always listed                         |
| `conversationSummary` | Compact log/plan string           | Derived from turns                    |

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

Later, `@atlas-ai/memory` and the knowledge graph implement `ContextProvider` (or the `MemoryRetriever` / `KnowledgeRetriever` ports) without changing the pipeline shape.

---

## Conversation continuity

Same `sessionId` reuses turns. The pipeline appends the user utterance during load and the assistant reply after response generation.

---

## Commands

```bash
pnpm core:build
pnpm test   # includes packages/core/src/context tests
```
