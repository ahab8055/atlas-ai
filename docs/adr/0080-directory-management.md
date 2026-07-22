# ADR-0080: Directory management

- **Status:** Accepted
- **Date:** 2026-07-22
- **Deciders:** Atlas AI project team

## Context

ADR-0075 covered list/walk/resolve. ADR-0074 left directory move
unsupported (`moveFile` rejected dirs) and delete was recursive with no
empty-folder API. Users needed create, rename/move folders, delete empty
folders, and existence checks — platform-independent via `os.files`.

## Decision

1. Extend `createDirectory` to return `{ path, created }` with optional
   `recursive` (default true).
2. Add `directoryExists` / `pathExists` for non-throwing validation.
3. Add `movePath` using platform `rename` for files and directories; reject
   self-descendant moves; optional overwrite of file or empty dest dir.
   Keep `moveFile` as a thin alias.
4. Add `deleteDirectory` — empty directories only (`listDir` must be empty).
   Recursive dir delete remains available via existing `deleteFile`.
5. Memory FS `rename` rewrites descendant keys for directory trees.
6. Tools: bump `file.mkdir` / `file.move`; add `file.rmdir` and
   `file.exists`.

## Consequences

### Positive

- Folder organization without copy+delete or text-only file moves.
- Safer empty-dir delete separate from recursive remove.

### Negative / trade-offs

- Same-volume `rename` only (no `EXDEV` fallback).
- `deleteFile` on a directory is still recursive (documented).

## Related

- [File-System-Access.md](../guides/File-System-Access.md)
- [ADR-0074](./0074-file-system-access-service.md)
- [ADR-0075](./0075-directory-navigation.md)
- [ADR-0079](./0079-file-writing-engine.md)
