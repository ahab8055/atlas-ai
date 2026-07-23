# ADR-0088: Large file processing

- **Status:** Accepted
- **Date:** 2026-07-23
- **Deciders:** Atlas AI project team

## Context

`readFile` already supports one windowed `offset` + `maxBytes` read
(ADR-0078). Product callers still lacked a sequential chunk iterator, first-class
config for size limits, and a tool that could walk large files without dumping
the whole content into agent context. Platform `readBytes` remains sync and
windowed — no stream API.

## Decision

1. Add `readFileChunks` / `forEachFileChunk` on `FileAccessService`: sequential
   `readBytes` windows; peak memory ≈ one chunk.
2. Service options + config: `maxReadBytes` (256 KiB), `maxChunkBytes` (256 KiB),
   `maxAtomicAppendBytes` (16 MiB). Reject `chunkSize > maxChunkBytes`.
3. Env: `ATLAS_FS_MAX_READ_BYTES`, `ATLAS_FS_MAX_CHUNK_BYTES`,
   `ATLAS_FS_MAX_ATOMIC_APPEND_BYTES`. CLI bootstrap passes them through.
4. Tool `file.read.chunks` with `maxChunks` (default 32). Keep `file.read` as
   single-window.
5. No schema bump. Indexer content cap (ADR-0087) unchanged. No Node/Web
   `ReadableStream` in this slice.

## Consequences

### Positive

- Large text files processable without loading whole file into RAM.
- Configurable limits and a bounded tool surface for agents.

### Negative / trade-offs

- Sync windowed iteration, not true async streams / mmap.
- Text chunks only; no cross-chunk structured parse.

## Related

- [File-System-Access.md](../guides/File-System-Access.md)
- [Configuration.md](../guides/Configuration.md)
- [ADR-0078](./0078-file-reading-engine.md)
- [ADR-0087](./0087-file-indexing-service.md)
