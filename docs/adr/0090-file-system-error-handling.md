# ADR-0090: File system error handling

- **Status:** Accepted
- **Date:** 2026-07-23
- **Deciders:** Atlas AI project team

## Context

Product FS threw raw `PlatformError` with overloaded `invalid_input` (paths,
unsupported types, args). Disk-full (`ENOSPC` / `EDQUOT`) collapsed to
`io_error`. Tools returned platform codes only — not Atlas-shaped objects.
Tools cannot import `@atlas-ai/core` (cycle); core already depends on
filesystem.

## Decision

1. Add platform code `disk_full`; translate `ENOSPC` / `EDQUOT` to it
   (ADR-0068 extension). Tag `detail.fsKind` for product kinds.
2. Introduce `FileSystemError` (extends `PlatformError`) with six kinds:
   `permission_denied`, `file_not_found`, `invalid_path`, `unsupported_type`,
   `disk_full`, `unknown`.
3. `toAtlasFileSystemError` builds AtlasErrorResponse-compatible payloads
   (`fs_*` codes) without importing core.
4. Retarget product throws in service/paths/watcher; wrap native write failures
   via `fromPlatformErrorForFs`.
5. File tools `fail()` attach `data.atlas`; core `fromPlatformError` prefers
   FS atlas mapping when `FileSystemError` / `fsKind` / `disk_full`.

## Consequences

### Positive

- Consistent six-category taxonomy for developers and agents.
- Atlas-shaped errors at tool and pipeline boundaries.

### Negative / trade-offs

- Memory-fs still throws low-level `PlatformError`; product layer normalizes.
- ExecutionController may still surface `tool_failed` above `data.atlas`.

## Related

- [File-System-Access.md](../guides/File-System-Access.md)
- [Error-Handling.md](../guides/Error-Handling.md)
- [ADR-0020](./0020-error-handling-framework.md)
- [ADR-0068](./0068-os-error-translation.md)
