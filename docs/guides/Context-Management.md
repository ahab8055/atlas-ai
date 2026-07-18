# Atlas AI — Context Management

Collects relevant context **before** planning and execution so responses can be personalized and accurate.

Related: [Request-Pipeline.md](./Request-Pipeline.md), [Intent-Detection.md](./Intent-Detection.md), [Architecture/22-AI-Orchestration-Architecture.md](../Architecture/22-AI-Orchestration-Architecture.md) (Context Manager), [Architecture/04-Memory-Architecture.md](../Architecture/04-Memory-Architecture.md), [Memory-Architecture.md](./Memory-Architecture.md), [Short-Term-Memory.md](./Short-Term-Memory.md), [Long-Term-Memory.md](./Long-Term-Memory.md), [Memory-Retrieval.md](./Memory-Retrieval.md), [Knowledge-Graph.md](./Knowledge-Graph.md), [ADR-0009](../adr/0009-context-management.md), [ADR-0040](../adr/0040-memory-architecture-foundation.md), [ADR-0041](../adr/0041-short-term-memory.md), [ADR-0042](../adr/0042-long-term-memory.md), [ADR-0044](../adr/0044-memory-retrieval-engine.md), [ADR-0049](../adr/0049-knowledge-graph-context-retrieval.md), [`@atlas-ai/core`](../../packages/core/), [`@atlas-ai/memory`](../../packages/memory/).

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

| Field                 | Source                                | MVP                                                                                                                                      |
| --------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `conversation`        | Current session turns                 | Short-term buffer (window + TTL); see [Short-Term-Memory.md](./Short-Term-Memory.md)                                                     |
| `preferences`         | User preferences                      | Defaults (`preferredEditor: VS Code`)                                                                                                    |
| `activeTasks`         | Active / working tasks                | In-memory store                                                                                                                          |
| `systemState`         | Runtime / platform / input source     | Live `process` info                                                                                                                      |
| `project`             | Project context                       | Stub (`Atlas AI`)                                                                                                                        |
| `memories`            | `@atlas-ai/memory` long-term (SQLite) | Hybrid retrieval when DB enabled; see [Memory-Retrieval.md](./Memory-Retrieval.md)                                                       |
| `knowledge`           | Personal knowledge graph              | Ranked neighbors (lexical + hop + weight + recency) when DB wired; see [Knowledge-Graph.md](./Knowledge-Graph.md) / ADR-0049; else empty |
| `sources`             | Provider ids that ran                 | Always listed                                                                                                                            |
| `conversationSummary` | Compact log/plan string               | Derived from turns                                                                                                                       |

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
