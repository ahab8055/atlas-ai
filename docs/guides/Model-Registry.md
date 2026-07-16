# Atlas AI — Model Registry

Catalog of installed AI models with persistent metadata (Architecture/25).

Related: [Architecture/25](../Architecture/25-Model-Management-System.md), [Architecture/20](../Architecture/20-Database-Schema.md), [Local-AI-Runtime.md](./Local-AI-Runtime.md), [Model-Storage.md](./Model-Storage.md), [Database.md](./Database.md), [ADR-0024](../adr/0024-model-registry.md), [`@atlas-ai/ai`](../../packages/ai/), [`@atlas-ai/database`](../../packages/database/).

---

## Purpose

- Register installed models (GGUF under `models/` and explicit entries).
- Store metadata: name, version, format, size, context length, capabilities, hardware requirements, location.
- Query available models for CLI / runtime.
- Persist entries in SQLite `models` table (schema v3).

---

## Packages

| Piece                                     | Role                                                    |
| ----------------------------------------- | ------------------------------------------------------- |
| `ModelRegistry` (`@atlas-ai/ai`)          | Domain API: register, list, get, remove, `syncFromDisk` |
| `ModelRegistryStore`                      | Persistence port (memory or SQLite adapter)             |
| `ModelsRepository` (`@atlas-ai/database`) | SQLite CRUD for `models`                                |
| `createPersistentModelRegistryStore`      | Duck-typed bridge without AI→database dependency        |

`InferenceProviderRegistry` (providers) is separate from this **model catalog**.

---

## CLI

```bash
pnpm atlas ai register          # scan models/*.gguf → persist
pnpm atlas ai models            # query registry (SQLite when DB enabled)
pnpm atlas --no-db ai models    # in-memory registry only
```

Core CLI startup also syncs on-disk GGUF files into SQLite (same as tools).

---

## Programmatic

```ts
import {
  createModelRegistry,
  createPersistentModelRegistryStore,
} from "@atlas-ai/ai";
import { openAtlasDatabase } from "@atlas-ai/database";

const db = openAtlasDatabase();
const registry = createModelRegistry({
  store: createPersistentModelRegistryStore(db.models),
  modelsDir: "./models",
});
registry.syncFromDisk();
const available = registry.list({ status: "available", capability: "chat" });
```

---

## Out of scope (this story)

Model marketplace UI, auto GPU detection polish, model router, embeddings manager.
