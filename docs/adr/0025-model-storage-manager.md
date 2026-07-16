# ADR-0025: Model storage manager

- **Status:** Accepted
- **Date:** 2026-07-16
- **Deciders:** Atlas AI project team

## Context

Architecture/25 defines a Model Storage Manager for local weight files: directory structure, usage monitoring, validation, and removal. ADR-0024 added a registry catalog but deferred nested `models/{general,coding,…}` layout and filesystem lifecycle operations.

## Decision

1. Add `ModelStorageManager` in `@atlas-ai/ai` owning structure, usage, validation, and safe removal under `paths.modelsDir`.
2. Adopt Architecture/25 folders: `general`, `coding`, `embeddings`, `speech` (plus legacy root `.gguf`).
3. Share `listStoredGgufFiles` / `resolveStoredModelPath` with registry discovery and llama.cpp local scan.
4. Category model ids use relative paths (`coding/name`); removal refuses paths outside `modelsDir`.
5. CLI: `atlas ai storage`, `atlas ai validate`, `atlas ai remove <id>`.

## Consequences

### Positive

- Models live in a controlled, documented layout.
- Invalid GGUF files are detectable; storage usage is monitorable.
- Registry and inference stay aligned on the same file inventory.

### Negative / trade-offs

- Download / install marketplace and `model.json` sidecars remain deferred.
- Only one nesting level of categories (no deep recursion).

### Follow-ups

- Installation system (download + compatibility checks).
- Optional checksum metadata files.
