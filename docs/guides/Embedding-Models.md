# Atlas AI — Embedding Model Integration

Local embedding generation and storage for semantic search and memory (Architecture/25 Embedding Model Manager, Architecture/24 Embedding System).

Related: [Local-AI-Runtime.md](./Local-AI-Runtime.md), [Model-Storage.md](./Model-Storage.md), [Database.md](./Database.md), [ADR-0034](../adr/0034-embedding-model-integration.md), [`@atlas-ai/ai`](../../packages/ai/), [`@atlas-ai/database`](../../packages/database/).

---

## Purpose

- Run **local embedding models** separately from chat LLMs.
- Provide an **embedding generation service**.
- **Store** vectors (content, embedding, source, metadata, timestamp).
- **Prepare** search/memory packages via `findSimilar` + SQLite `embeddings` table.

---

## Independence from chat

| Concern        | Chat                        | Embeddings                               |
| -------------- | --------------------------- | ---------------------------------------- |
| Provider port  | `InferenceProvider`         | `EmbeddingProvider`                      |
| Mock (CI)      | `mock`                      | `mock-embeddings`                        |
| Local HTTP     | `llamacpp` chat completions | `llamacpp-embeddings` → `/v1/embeddings` |
| Weights folder | `models/general`, `coding`  | `models/embeddings`                      |

---

## CLI

```bash
# Generate (mock by default — offline)
pnpm atlas ai embed "How does authentication work?"

# Generate + persist for memory/search consumers
pnpm atlas ai embed --store --collection memory --source note "I prefer TypeScript"

pnpm atlas ai embeddings list memory
pnpm atlas ai embeddings search "TypeScript preferences"
pnpm atlas ai embeddings remove <id>
```

Use a real llama-server embedding model:

```bash
ATLAS_AI_EMBED_PROVIDER=llamacpp ATLAS_AI_EMBED_MODEL=nomic-embed-text \
  pnpm atlas ai embed "hello"
```

---

## API

```ts
import {
  createEmbeddingService,
  MockEmbeddingProvider,
  createPersistentEmbeddingStore,
} from "@atlas-ai/ai";
import { openAtlasDatabase } from "@atlas-ai/database";

const db = openAtlasDatabase();
const service = createEmbeddingService({
  provider: new MockEmbeddingProvider(),
  store: createPersistentEmbeddingStore(db.embeddings),
  defaultModelId: "mock-embed-384",
});

const vector = await service.embed("semantic query");
const stored = await service.embedAndStore("user preference…", {
  collection: "memory",
});
const hits = await service.findSimilar("coding setup", {
  collection: "memory",
  limit: 5,
});
```

### Storage shape (Architecture/24)

| Field                   | Role                                         |
| ----------------------- | -------------------------------------------- |
| `content`               | Original text                                |
| `embedding`             | Float32 LE BLOB                              |
| `collection`            | `memory` / `search` / `document` / `general` |
| `source`                | Optional provenance                          |
| `metadata`              | JSON bag for consumers                       |
| `model_id` / `provider` | Which embedding model produced it            |

Schema version **4** adds the `embeddings` table. Cosine similarity runs in-process (SQLite vector extension deferred).

---

## Future consumers

- **Search** — keyword + semantic hybrid over `collection=search|document`
- **Memory** — `collection=memory` rows injected into context assembly

Both call `EmbeddingService.embed` / `findSimilar` (or the repository) without touching chat providers.

---

## Out of scope

Full retrieval orchestrator, SQLite vector extension, BGE model download UX, re-ranking.
