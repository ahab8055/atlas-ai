# ADR-0024: Model registry

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Atlas AI project team

## Context

Architecture/25 requires a model registry that tracks installed models and metadata (name, version, format, size, context length, capabilities, requirements, location). ADR-0022/0023 cover inference providers and llama.cpp loading, but provider `listModels()` is ephemeral and incomplete for durable catalog queries.

## Decision

1. Add `ModelRegistry` in `@atlas-ai/ai` with a pluggable `ModelRegistryStore` port.
2. Persist via SQLite `models` table in `@atlas-ai/database` (schema version **3**), exposed as `ModelsRepository`.
3. Bridge with `createPersistentModelRegistryStore` so AI does not depend on the database package.
4. Discover installed GGUF files with `syncFromDisk` / `scanInstalledGgufModels`.
5. CLI: `atlas ai register` and enriched `atlas ai models`; auto-sync on CLI DB open.

## Consequences

### Positive

- Installed models are registerable and queryable with full metadata.
- Persistence survives restarts; memory store remains for tests / `--no-db`.
- Clear separation: provider registry ≠ model catalog.

### Negative / trade-offs

- Capability filter uses SQL `LIKE` on JSON (good enough for MVP).
- Nested `models/{general,coding}` layouts and downloads remain out of scope (see ADR-0025 for storage layout).

### Follow-ups

- Model download / marketplace and richer capability indexes.
- Model router.
