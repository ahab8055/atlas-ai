# Atlas AI — Short-Term Memory

Bounded session conversation buffer so follow-up questions feel natural.

Related: [Memory-Architecture.md](./Memory-Architecture.md),
[Context-Management.md](./Context-Management.md),
[Configuration.md](./Configuration.md),
[Architecture/04-Memory-Architecture.md](../Architecture/04-Memory-Architecture.md)
(Working Memory), [ADR-0041](../adr/0041-short-term-memory.md),
[`@atlas-ai/memory`](../../packages/memory/).

---

## Behavior

- Stores user commands and assistant responses per `sessionId`
- Trims oldest turns when over `maxEntries`
- Drops turns older than `ttlMs` on append / get / prune (`ttlMs: 0` disables TTL)
- Optionally mirrors turns into working `MemoryRecord`s (`metadata.kind = conversation_turn`)

Defaults: **50** entries, **30 minutes** TTL.

---

## Config

| Setting   | JSON / env                                                            |
| --------- | --------------------------------------------------------------------- |
| Max turns | `memory.shortTerm.maxEntries` / `ATLAS_MEMORY_SHORT_TERM_MAX_ENTRIES` |
| TTL (ms)  | `memory.shortTerm.ttlMs` / `ATLAS_MEMORY_SHORT_TERM_TTL_MS`           |

---

## Usage

```ts
import { createMemoryManager, createShortTermMemory } from "@atlas-ai/memory";

const memoryManager = createMemoryManager();
const shortTerm = createShortTermMemory({
  maxEntries: 50,
  ttlMs: 1_800_000,
  memoryManager,
});

shortTerm.append("sess-1", {
  role: "user",
  text: "open my project",
  at: new Date().toISOString(),
});

const turns = shortTerm.getTurns("sess-1");
const store = shortTerm.toConversationStore(); // ContextManager conversationStore
```

CLI `createCliRuntime` loads config and wires ShortTermMemory into `ContextManager`.

---

## Out of scope

- Long-term / episodic promotion
- SQLite durability
- Vector recall / desktop Memory UI
