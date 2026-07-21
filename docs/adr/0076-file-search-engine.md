# ADR-0076: File search engine

- **Status:** Accepted
- **Date:** 2026-07-21
- **Deciders:** Atlas AI project team

## Context

ADR-0074 added `findFiles` with recursive name/content matching and a fixed
service `maxDepth`. Users needed a clearer **search engine**: per-query depth,
hidden filtering, extension filters, richer wildcards, hit metadata, and
guards so large trees stay responsive. Walk/list already had hidden filters;
search did not.

## Decision

1. Expand `FindFilesQuery` with `maxDepth`, `includeHidden` (default false),
   `extensions`, `filesOnly` (default true).
2. Change `findFiles` to return `FileSearchResult` (`hits`, `truncated`,
   `scannedEntries`, `durationMs`) with enriched `FileHit` metadata
   (`isFile`, `extension`, `mtimeMs`, symlink flag).
3. Glob matching: `*` and `?` via `patternToRegExp` (anchored basename match).
4. Performance: use `lstat`, do not follow symlink directories, prune hidden
   unless requested, apply extension filter before content reads, stop at
   `limit`.
5. Bump `file.search` tool inputs/outputs accordingly.

## Consequences

### Positive

- Accurate, filterable search with observable scan cost.
- Aligns hidden/symlink policy with directory navigation (ADR-0075).

### Negative / trade-offs

- Return type break for typed `findFiles` callers (tools updated).
- Still a walk-based search — not a durable index (Arch/24 deferred).

## Related

- [File-System-Access.md](../guides/File-System-Access.md)
- [ADR-0074](./0074-file-system-access-service.md)
- [ADR-0075](./0075-directory-navigation.md)
