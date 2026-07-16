# Atlas AI — Model Storage

Controlled local storage for AI model weight files (Architecture/25).

Related: [Architecture/25](../Architecture/25-Model-Management-System.md), [Model-Registry.md](./Model-Registry.md), [Local-AI-Runtime.md](./Local-AI-Runtime.md), [LlamaCpp-Integration.md](./LlamaCpp-Integration.md), [ADR-0025](../adr/0025-model-storage-manager.md), [`@atlas-ai/ai`](../../packages/ai/), [`models/`](../../models/).

---

## Purpose

- Keep models in a **controlled directory** (`paths.modelsDir`, default `models/`).
- Define the **Architecture/25 layout**: `general/`, `coding/`, `embeddings/`, `speech/` (plus legacy root `.gguf` files).
- **Monitor storage usage** (file count, bytes, valid vs invalid).
- **Validate** GGUF magic headers.
- **Remove** model files safely (never deletes outside `models/`).

Download / marketplace install is a separate story — use [Model-Installation.md](./Model-Installation.md) to install a known GGUF path/URL.

---

## Layout

```
models/
├── general/
├── coding/
├── embeddings/
├── speech/
└── optional-legacy.gguf   # still supported at root
```

Category model ids look like `coding/coder` (relative path without `.gguf`).

---

## Package API

```ts
import { createModelStorageManager } from "@atlas-ai/ai";

const storage = createModelStorageManager({ modelsDir: "./models" });
storage.ensureStructure();
const usage = storage.getUsage();
const invalid = storage.validateAll().filter((m) => !m.validation.ok);
storage.remove("coding/old-model");
```

Registry discovery (`scanInstalledGgufModels` / `atlas ai register`) uses the same scanner.

---

## CLI

```bash
pnpm atlas ai storage              # ensure dirs + usage report
pnpm atlas ai validate             # flag invalid GGUF files (exit 1 if any)
pnpm atlas ai remove coding/old    # delete file + unregister from catalog
```

---

## Out of scope

Model download, checksum `model.json` sidecars, automatic GPU sizing, model router.
