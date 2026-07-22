# ADR-0083: Safe file operations

- **Status:** Accepted
- **Date:** 2026-07-22
- **Deciders:** Atlas AI project team

## Context

Users need protection against accidental data loss. ADR-0081 soft-delete and
overwrite defaults help, and ADR-0082 gates capabilities, but CLI pre-granted
`filesystem.write` / `filesystem.delete`, approving once unlocked the session,
and overwrite cleared destinations without a recoverable backup.

## Decision

1. **One-shot approvals** — `resolveApproval(id, "approved", { sessionGrant: false })`
   does not grant the capability; it installs a one-shot allow for
   `capability` + `resource` + `reason`, consumed on the next matching
   `requestPermission`. Default `sessionGrant: true` preserves existing memory
   and trusted-execution behavior. Move/restore approvals one-shot both write
   and delete.
2. **Destructive ops** (delete*, restore, overwrite/append write, overwrite
   copy/move) use one-shot confirmation. Non-destructive create write/mkdir may
   still session-grant.
3. **Overwrite backups** — before replacing existing content, move the prior
   path into Atlas trash; return `backupId` / `backedUp` on write/copy/move
   results; restore via `restorePath`.
4. **Path validation** — overwrite/backup targets pass `assertAllowed`.
5. **CLI** — pre-grant only `filesystem.read` (plus memory). TTY confirm host
   via `configureFsConfirmHost` / `withFsConfirmRetry` on file tools (one retry).

## Consequences

### Positive

- Destructive FS ops require explicit per-op confirmation when caps are not
  pre-granted.
- Overwrites are restorable through trash.
- Broker + product capability checks remain defense-in-depth (ADR-0066 / 0082).

### Negative / trade-offs

- Non-TTY / denied confirm fails closed (no silent auto-approve).
- First non-destructive write still needs a confirm unless granted.
- No Permission Center UI yet; CLI uses stderr prompt.

## Related

- [File-System-Access.md](../guides/File-System-Access.md)
- [ADR-0081](./0081-file-management-operations.md)
- [ADR-0082](./0082-file-permission-validation.md)
- [ADR-0014](./0014-permission-management-foundation.md)
