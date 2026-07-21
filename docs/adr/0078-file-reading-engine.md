# ADR-0078: File reading engine

- **Status:** Accepted
- **Date:** 2026-07-21
- **Deciders:** Atlas AI project team

## Context

ADR-0074 `readFile` returned UTF-8 text with a hard size reject. Callers needed
format-aware reading (text, JSON, YAML, Markdown, CSV, XML, source), encoding
detection, efficient large-file windows, and a structured content envelope —
without new npm dependencies.

## Decision

1. Extend platform `readBytes(path, opts?: { offset?, length? })` for windowed
   reads (full-file default preserves checksum callers). Broker unchanged
   (`filesystem.read`).
2. Evolve product `readFile(path, opts?)` to return `FileContent` with
   `format`, `mimeType`, `encoding`, `byteOffset`, `byteLength`, `truncated`,
   optional `data` / `parseError`. Soft-window large files (`truncated: true`)
   instead of hard reject for size alone.
3. Encoding via BOM detection (UTF-8 / UTF-16 LE/BE) + `TextDecoder`; reject
   binary-like content and known binary MIME (images/pdf/zip/…).
4. Parse-safe structured data (no new deps): JSON (`JSON.parse`), YAML lite
   (maps/lists/scalars, depth ≤ 8), CSV rows (`string[][]`). Markdown / XML /
   source remain text + format metadata.
5. Bump tool `file.read` to v1.1.0 with `offset` / `maxBytes` / `parse`.

## Consequences

### Positive

- Agents get typed JSON/YAML/CSV when safe, with text always available.
- Large files readable in windows without loading entire contents.

### Negative / trade-offs

- YAML/CSV are subset parsers, not full language support.
- No content sniffing / libmagic; format from extension.
- Search content-scan still uses `readText` + existing cap (unchanged).

## Related

- [File-System-Access.md](../guides/File-System-Access.md)
- [ADR-0074](./0074-file-system-access-service.md)
- [ADR-0077](./0077-file-metadata-service.md)
