# Atlas AI — Memory Architecture Foundation

Modular memory layer for storing and retrieving typed knowledge without coupling
callers to a specific backend.

Related: [Architecture/04-Memory-Architecture.md](../Architecture/04-Memory-Architecture.md),
[Context-Management.md](./Context-Management.md),
[Short-Term-Memory.md](./Short-Term-Memory.md),
[Long-Term-Memory.md](./Long-Term-Memory.md),
[Memory-Classification.md](./Memory-Classification.md),
[ADR-0040](../adr/0040-memory-architecture-foundation.md),
[ADR-0043](../adr/0043-memory-classification-engine.md),
[`@atlas-ai/memory`](../../packages/memory/).

---

## Goals

- Common interfaces for create / read / update / delete / query / clear
- Isolated stores per memory type
- Pluggable providers (register a new backend without changing `MemoryManager`)

---

## Types and scopes

Canonical types (Architecture/04):

| `MemoryType` | Scope        | Role                                  |
| ------------ | ------------ | ------------------------------------- |
| `working`    | `short_term` | Session / active task scratchpad      |
| `episodic`   | `long_term`  | Past interactions and incidents       |
| `semantic`   | `long_term`  | Preferences, facts, project knowledge |
| `procedural` | `long_term`  | Repeated workflows and habits         |

User-story “short-term” / “long-term” map to `MemoryScope`, not separate store types.

---

## Package layout

```
packages/memory/src/
├── types.ts              # MemoryRecord, query inputs, scope helpers
├── provider.ts           # MemoryProvider port
├── registry.ts           # MemoryProviderRegistry
├── manager.ts            # MemoryManager facade + toMemorySnippets
├── classification/       # Importance gate (classifyMemory, purge)
├── retrieval/            # Hybrid rank (MemoryRetrievalEngine)
├── consolidation/        # Dedupe + conflict flags
├── long-term/            # SQLite LongTermMemory facade
├── short-term/           # Conversation window + TTL
├── errors.ts
└── providers/
    ├── in-memory.ts      # Four isolated in-memory providers
    ├── in-memory-store.ts
    ├── sqlite.ts         # Persistent long-term providers
    ├── persistent.ts
    └── register.ts       # registerBuiltinMemoryProviders
```

---

## Usage

```ts
import { createMemoryManager, toMemorySnippets } from "@atlas-ai/memory";

const memory = createMemoryManager();

await memory.store({
  type: "semantic",
  content: "Preferred editor is Cursor",
  importance: 0.9,
  confidence: 0.95,
});

const hits = await memory.query({ text: "editor", limit: 5 });
const snippets = toMemorySnippets(hits, "editor");
```

Working memory can be session-scoped:

```ts
await memory.store({
  type: "working",
  content: "Current task: run tests",
  sessionId: "sess-1",
});
await memory.clear("working", { sessionId: "sess-1" });
```

For conversation turns with a configurable window and TTL, use
[Short-Term-Memory.md](./Short-Term-Memory.md) (`createShortTermMemory`).

For persistent facts/preferences across restarts, use
[Long-Term-Memory.md](./Long-Term-Memory.md) (`createLongTermMemory` / SQLite).
Before auto-storing candidates, run the importance gate in
[Memory-Classification.md](./Memory-Classification.md).

---

## Adding a provider

Implement `MemoryProvider` for one `MemoryType`, then register:

```ts
import {
  createMemoryManager,
  MemoryProviderRegistry,
  registerBuiltinMemoryProviders,
  type MemoryProvider,
} from "@atlas-ai/memory";

const registry = new MemoryProviderRegistry();
registerBuiltinMemoryProviders(registry);
registry.register(mySqliteEpisodicProvider, { replace: true });

const memory = createMemoryManager({ registry, skipBuiltins: true });
```

`MemoryManager` routes by type and does not import provider internals.

---

## Context pipeline

`toMemorySnippets` matches core `MemorySnippet` shape. Wiring into
`createMemoryProvider` / `handleRequest` is a follow-up (ADR-0009); the default
context `memory` provider still returns empty until that integration lands.

---

## Out of scope (this foundation)

- SQLite / encrypted durable store
- Vector search and embeddings
- HTTP Memory API / desktop Memory UI
- Automatic importance scoring ML
