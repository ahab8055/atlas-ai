# ADR-0087: File indexing service

- **Status:** Accepted
- **Date:** 2026-07-23
- **Deciders:** Atlas AI project team

## Context

Live `file.search` walks the tree on every query. Architecture/24 calls for a
persistent file index (metadata + keyword FTS, later embeddings). Foundations
already exist: ignore rules (ADR-0086), watcher/EventBus (ADR-0084), and the
generic `embeddings` table. Recent-files MRU (ADR-0085) is access history, not
a content index.

## Decision

1. Schema v12: `indexed_files` metadata + `indexed_files_fts` (FTS5,
   path-keyed sync).
2. Package `@atlas-ai/search`: `FileIndexingService` with `build`, `indexPath`,
   `applyFsEvent`, `search`, `status`.
3. Content: text/markdown/json/yaml/csv/source/xml only; size-capped; SHA-256
   hash short-circuit for unchanged files. Always respect ignore rules.
4. Incremental: CLI subscribes to FS EventBus events → `applyFsEvent`. No
   full-scan on every process start; `atlas index build` for bulk catch-up.
5. Semantic integration: `SemanticIndexSink` no-op by default; future ADR wires
   embeddings with `collection: "files"`.
6. Tool `file.index.search` via injected query façade; live `file.search` unchanged.

## Consequences

### Positive

- Fast keyword search over indexed corpus.
- Incremental updates without rewalking the tree.
- Clear extension point for semantic search.

### Negative / trade-offs

- Index can be stale until build/watch events run.
- No hybrid/vector retrieval in this slice.

## Related

- [File-System-Access.md](../guides/File-System-Access.md)
- [Database.md](../guides/Database.md)
- [CLI.md](../guides/CLI.md)
- [Architecture/24](../Architecture/24-Search-and-Retrieval-Architecture.md)
- [ADR-0084](./0084-file-watcher-service.md)
- [ADR-0085](./0085-recent-files-index.md)
- [ADR-0086](./0086-ignore-rules-engine.md)
