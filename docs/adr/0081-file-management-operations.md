# ADR-0081: File management operations

- **Status:** Accepted
- **Date:** 2026-07-22
- **Deciders:** Atlas AI project team

## Context

ADR-0080 added directory move/rename via `files.rename` and empty-only
`deleteDirectory`. Users still needed **copy**, **overwrite-protected**
transfers, **detailed delete results**, and **restore where supported**.
OS Trash APIs are uneven; Atlas chose an app-managed trash under each root.

## Decision

1. Add platform `copyFile` (`copyFileSync`; fails if dest exists). Broker
   capability `filesystem.write`.
2. Product `copyPath` (files + recursive directories), `renamePath` (alias of
   `movePath`), `deletePath` / `restorePath`.
3. Soft-delete default: move into `{roots[0]}/.atlas/trash/{trashId}/` with
   `manifest.json` + `payload/`. Hard delete via `trash: false`.
4. Restore by `trashId`; fail if original path is occupied. Refuse deleting
   `.atlas` metadata paths.
5. Overwrite defaults remain `false` for copy/move.
6. Tools: `file.copy`, `file.rename`, `file.restore`; bump `file.delete`
   (trash default true).

## Consequences

### Positive

- Automation-friendly copy/move/delete/restore with structured results.
- Cross-platform restore without OS Trash.

### Negative / trade-offs

- Copy of directories is best-effort (not fully transactional).
- No EXDEV move fallback; no trash TTL/auto-purge.
- Soft-delete uses disk under the workspace root.

## Related

- [File-System-Access.md](../guides/File-System-Access.md)
- [ADR-0074](./0074-file-system-access-service.md)
- [ADR-0080](./0080-directory-management.md)
