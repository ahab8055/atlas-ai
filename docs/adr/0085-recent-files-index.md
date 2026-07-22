# ADR-0085: Recent files index

- **Status:** Accepted
- **Date:** 2026-07-22
- **Deciders:** Atlas AI project team

## Context

Users and agents need a lightweight MRU of paths they actually opened or
saved. Architecture/24 mentions “recent files” as a ranking signal for a
future content index; that full FTS/embedding index remains deferred
([File-System-Access.md](../guides/File-System-Access.md), ADR-0074). Closest
existing patterns are `projects.last_seen_at` and task history `listRecent`.

## Decision

1. Add SQLite table `recent_files` (schema v11): path, `last_action`
   (`read`|`write`), `last_accessed_at`, `access_count`, UNIQUE `(user_id, path)`.
2. Record **user/agent access** from successful `FileAccessService`
   `readFile` / `writeFile` via `onAccess`. On delete/trash call
   `onPathGone` → `remove`. On move: remove source + touch destination as
   write. Do **not** record list/search/metadata or watcher create/update.
3. Keep DB out of `@atlas-ai/tools`: query façade in `@atlas-ai/filesystem`
   (`setRecentFilesStore` / `listRecentFiles`); CLI injects the repository
   adapter when the database is enabled.
4. Expose `file.recent` tool and `atlas recent` CLI for filter/sort
   (`recent`|`frequent`, `pathPrefix`, `action`, `since`, `limit`).

## Consequences

### Positive

- Durable MRU with timestamps and frequency, indexed for fast list queries.
- Tools stay coupled only to filesystem; no tools→database hard dep.

### Negative / trade-offs

- Not a content index; Architecture/24 hybrid search remains separate work.
- Access is best-effort (callback errors must not fail FS ops).

## Related

- [File-System-Access.md](../guides/File-System-Access.md)
- [Database.md](../guides/Database.md)
- [ADR-0074](./0074-file-system-access-service.md)
- [Architecture/24](../Architecture/24-Search-and-Retrieval-Architecture.md)
