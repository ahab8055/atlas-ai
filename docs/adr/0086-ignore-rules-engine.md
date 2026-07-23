# ADR-0086: Ignore Rules Engine

- **Status:** Accepted
- **Date:** 2026-07-23
- **Deciders:** Atlas AI project team

## Context

Search, walk, list, and watch scanned entire trees including `node_modules`,
build outputs, and temps. Security deny lists (ADR-0074) block sensitive paths
but do not prune dependency trees. Architecture/24 content indexing is still
deferred; discovery must stay efficient for when indexing lands.

## Decision

1. Add `createIgnoreRulesEngine` in `@atlas-ai/filesystem` (no new npm deps).
2. Soft-skip layers: built-in defaults (`node_modules/`, temps, …), config
   `filesystem.ignorePatterns`, cascading `.gitignore`, root `.atlasignore`.
   Hidden names remain gated by `includeHidden` (orthogonal).
3. Wire into `listDirectory` / `walkDirectory` / `findFiles` and
   `FileWatcherService` (defaults apply even without `ignoreGlobs`).
   Per-call `respectIgnore` (default true). Prune ignored directories.
4. Explicit CRUD (`readFile` / `writeFile` / …) is **not** filtered — ignore
   is discovery-only. Security deny stays a hard gate.
5. Future Architecture/24 index **must** call the same engine.

## Consequences

### Positive

- Search/watch skip noisy trees by default.
- Shared matcher for future indexing.

### Negative / trade-offs

- Gitignore subset (not full `git check-ignore` parity).
- Ignore-file cache needs invalidate on `.gitignore` change (watcher
  best-effort).

## Related

- [File-System-Access.md](../guides/File-System-Access.md)
- [Configuration.md](../guides/Configuration.md)
- [ADR-0074](./0074-file-system-access-service.md)
- [ADR-0076](./0076-file-search-engine.md)
- [ADR-0084](./0084-file-watcher-service.md)
- [Architecture/24](../Architecture/24-Search-and-Retrieval-Architecture.md)
