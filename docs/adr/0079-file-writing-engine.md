# ADR-0079: File writing engine

- **Status:** Accepted
- **Date:** 2026-07-21
- **Deciders:** Atlas AI project team

## Context

ADR-0074 `writeFile` was create-or-overwrite UTF-8 via `writeText`. Users
needed create / overwrite / append modes, encoding selection (mirroring
ADR-0078), atomic temp→rename writes, and a write result for integrity
feedback — without new npm dependencies.

## Decision

1. Add platform `writeBytes`, `appendBytes`, and `rename` (brokered as
   `filesystem.write`).
2. Evolve product `writeFile` to return `WriteFileResult` with options:
   `mode` (`create` | `overwrite` | `append`), `encoding`, `atomic`, `bom`,
   plus legacy `overwrite` / `createDirs`.
3. Encode via `encodeBytes` (UTF-8 / UTF-16 LE/BE; UTF-16 always BOM).
4. Atomic create/overwrite: temp `writeBytes` then `rename`. Append with
   `atomic: true` rewrites under a 16 MiB size cap; otherwise `appendBytes`.
5. Preflight: roots/deny, reject directory targets, require parent or
   `createDirs`, reject `create` when path exists.
6. Bump tool `file.write` to v1.1.0.

## Consequences

### Positive

- Safer replaces for project files; append without full rewrite when needed.
- Encoding parity with the reading engine.

### Negative / trade-offs

- Append atomic rewrite loads the whole file (capped).
- Cross-volume rename fallbacks and fsync durability deferred.
- `moveFile` still copy+delete (not native rename).

## Related

- [File-System-Access.md](../guides/File-System-Access.md)
- [ADR-0074](./0074-file-system-access-service.md)
- [ADR-0078](./0078-file-reading-engine.md)
