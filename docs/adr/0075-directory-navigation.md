# ADR-0075: Directory navigation (list / walk / resolve / symlinks)

- **Status:** Accepted
- **Date:** 2026-07-21
- **Deciders:** Atlas AI project team

## Context

ADR-0074 added product `FileAccessService` for search and CRUD on top of
`os.files`. Users still needed explicit **directory navigation**: list folders,
traverse nested trees, resolve relative/absolute paths, and handle symbolic
links consistently on Windows, macOS, and Linux. Platform `stat` followed links
and exposed no symlink metadata.

## Decision

1. Extend platform `FileSystemService` with `lstat` / `readlink` and
   `FileStat.isSymbolicLink` (Node `lstatSync` / `readlinkSync`; brokered as
   `filesystem.read`).
2. Extend `FileAccessService` with `resolvePath`, `listDirectory`, and
   `walkDirectory` (`DirEntry` includes symlink flag + optional `linkTarget`).
3. **Symlink policy:** list/walk use `lstat` so links are visible; walk does
   **not** follow symlinks by default (`followSymlinks: false`). When following,
   resolve targets, require them inside roots, and skip cycles via a visited set.
4. Wire tools `file.resolve`, `file.list`, `file.walk`.
5. Document in File-System-Access guide; keep search/CRUD behavior from ADR-0074.

## Consequences

### Positive

- Agents can explore project trees safely without inventing ad-hoc `node:fs`
  walks.
- Cross-OS path resolution stays centralized with existing roots/deny rules.

### Negative / trade-offs

- Following symlinks is opt-in; dangling links report without crashing walk.
- Windows junctions appear only when Node marks `isSymbolicLink()`.

## Related

- [File-System-Access.md](../guides/File-System-Access.md)
- [ADR-0074](./0074-file-system-access-service.md)
- [ADR-0062](./0062-operating-system-interface.md)
- [Architecture/26](../Architecture/26-Computer-Interaction-Architecture.md)
