# ADR-0077: File metadata service

- **Status:** Accepted
- **Date:** 2026-07-21
- **Deciders:** Atlas AI project team

## Context

Platform `FileStat` exposed size, mtime, and type flags only. Search hits
carried partial fields. Callers needed a **unified metadata** surface: name,
extension, size, creation/modification dates, permissions, owner, MIME type,
and optional checksum — without inventing per-tool shapes.

## Decision

1. Enrich platform `FileStat` with `birthtimeMs`, `mode`, `uid`, `gid` from
   Node `Stats`. Add `FileSystemService.readBytes` (brokered as
   `filesystem.read`) for binary-safe hashing.
2. Add product `FileAccessService.getFileMetadata` returning `FileMetadata`
   (path, name, extension, size, type flags, dates, mode, permissions string,
   owner, MIME, optional SHA-256).
3. MIME from a small built-in extension map (`mime.ts`); directories →
   `inode/directory`; unfollowed symlinks → `inode/symlink`; else
   `application/octet-stream`. No libmagic / new npm dep.
4. Checksum SHA-256 via `readBytes` when under `maxChecksumBytes` (default
   16 MiB); otherwise set `checksumSkipped`. Skip for dirs / unfollowed
   symlinks.
5. Owner `name` only when `uid === process.getuid?.()` using
   `os.userInfo().username`.
6. Wire tool `file.metadata` (`filesystem.read`).

## Consequences

### Positive

- One API for agents/tools needing full file identity and integrity hints.
- Binary-safe reads without misusing `readText`.

### Negative / trade-offs

- Extension MIME only originally; content sniffing added in [ADR-0089](./0089-file-type-detection.md).
- No Windows SID / ACL owner resolution; large-file hashing capped.

## Related

- [File-System-Access.md](../guides/File-System-Access.md)
- [ADR-0074](./0074-file-system-access-service.md)
- [ADR-0075](./0075-directory-navigation.md)
- [ADR-0076](./0076-file-search-engine.md)
- [ADR-0089](./0089-file-type-detection.md)
