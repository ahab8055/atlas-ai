# ADR-0034: Embedding model integration

- **Status:** Accepted
- **Date:** 2026-07-16
- **Deciders:** Atlas AI project team

## Context

Architecture/25 requires an Embedding Model Manager separate from chat models. Architecture/24 needs embedding generation and storage (content, vector, source, metadata, timestamp) so search and memory can consume semantic representations. ADR-0018 deferred vector extensions; MVP still needs a local generation path and durable storage.

## Decision

1. Add `EmbeddingProvider` port + `EmbeddingService` in `@atlas-ai/ai` (`packages/ai/src/embeddings/`), independent of `InferenceProvider`.
2. Ship `MockEmbeddingProvider` (deterministic hash vectors) for CI and `HttpEmbeddingProvider` for llama-server `/v1/embeddings`.
3. Persist via SQLite `embeddings` table (schema v4) as Float32 BLOBs; expose `EmbeddingsRepository` and `createPersistentEmbeddingStore` bridge.
4. Provide `findSimilar` (cosine) as a prep API for future search/memory packages.
5. CLI: `atlas ai embed`, `atlas ai embeddings list|search|remove`.

## Consequences

### Positive

- Local embeddings work without chat models.
- Search/memory can store and query vectors today; swap in vector extensions later.
- Clear provider boundary avoids coupling retrieval to LLM generate.

### Negative / trade-offs

- Mock vectors are not semantically meaningful (tests/plumbing only).
- In-process cosine scan does not scale to huge corpora (acceptable for MVP).

### Follow-ups

- Wire memory creation pipeline and search orchestrator; optional sqlite-vss / vec0; download helpers for BGE/nomic GGUF into `models/embeddings/`.
