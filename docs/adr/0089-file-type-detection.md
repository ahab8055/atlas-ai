# ADR-0089: File type detection

- **Status:** Accepted
- **Date:** 2026-07-23
- **Deciders:** Atlas AI project team

## Context

MIME and logical format were extension-only (ADR-0077 / ADR-0078). Wrong
extensions misrouted reads, parsers, and the indexer. Content-based sniffing
was previously out of scope; product needs accurate type ID without libmagic
or PDF/DOCX extractors.

## Decision

1. Pure-JS `detectFileType` / `sniffSignature` in `@atlas-ai/filesystem`:
   extension map + magic-byte table (PNG/JPEG/GIF/WEBP/PDF/ZIP/GZIP) + light
   text heuristics (JSON/YAML/CSV/XML). Head window ≤ 4 KiB.
2. Conflict rule: binary signatures always win; text heuristics override only
   mismatch-friendly extensions (or high confidence); never upgrade a binary
   extension to text without a signature.
3. Processor registry: `processorForFormat` / `isIndexableFormat` map formats to
   existing read/index pipelines (`read.json` … `reject.binary`).
4. Wire into `readFile`, `getFileMetadata`, `detectFileType` service method,
   indexer gate, and tools (`file.detect`, extended `file.read` /
   `file.metadata`).
5. Supersedes the “no content sniffing” notes in ADR-0077 / 0078 for this
   bounded signature table only.

## Consequences

### Positive

- Correct pipeline when extensions lie.
- Shared detector for read, metadata, index, and tools.

### Negative / trade-offs

- Not full libmagic / HTML5 mimesniff.
- ZIP-based Office formats stay `binary` / reject (no DOCX extractors here).

## Related

- [File-System-Access.md](../guides/File-System-Access.md)
- [ADR-0077](./0077-file-metadata-service.md)
- [ADR-0078](./0078-file-reading-engine.md)
- [ADR-0087](./0087-file-indexing-service.md)
