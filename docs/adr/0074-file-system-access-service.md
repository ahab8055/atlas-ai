# ADR-0074: File System Access service (product layer)

- **Status:** Accepted
- **Date:** 2026-07-21
- **Deciders:** Atlas AI project team

## Context

Platform already exposes low-level CRUD as `FileSystemService` on
`OperatingSystem.files` / registry key `os.files` (ADR-0062). MVP Phase 4 and
Architecture/26 §3 require a **product** File System Access layer: search, read,
create, modify, and move — with path roots and sensitive-path denial — without
tools or agents calling `node:fs` directly. Builtin `file.search` remained a
stub (ADR-0012 follow-up).

## Decision

1. Add `@atlas-ai/filesystem` with **`FileAccessService`** (distinct from
   platform `FileSystemService`): `findFiles`, `readFile`, `writeFile`,
   `createDirectory`, `deleteFile`, `moveFile`.
2. Construct via DI only: inject `files: FileSystemService` (+ optional
   `paths`, `roots`, depth/size caps, deny patterns). Never import `node:fs`
   in this package.
3. Bootstrap with `bootstrapFileAccessFromRegistry` after platform registry
   registration; CLI sets roots to `process.cwd()`.
4. Wire real `file.search` / `file.read` / `file.write` / `file.mkdir` /
   `file.delete` / `file.move` tools in `@atlas-ai/tools` against the default
   FileAccessService.
5. Defer mass migration of existing `node:fs` callers (ai/logging/database)
   and persistent file indexing (Architecture/24) to later ADRs.

## Consequences

### Positive

- Product FS ops share one security boundary (roots + deny + brokered
  `os.files`).
- Tools no longer stub file search/write for MVP computer interaction.

### Negative / trade-offs

- Search is recursive walk (name/content), not a durable index.
- `moveFile` is read+write+remove (no native rename); directory moves unsupported.

## Related

- [File-System-Access.md](../guides/File-System-Access.md)
- [Platform-Abstraction.md](../guides/Platform-Abstraction.md)
- [ADR-0062](./0062-operating-system-interface.md)
- [ADR-0012](./0012-tool-registry.md)
- [Architecture/26](../Architecture/26-Computer-Interaction-Architecture.md)
