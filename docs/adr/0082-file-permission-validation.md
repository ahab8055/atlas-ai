# ADR-0082: File permission validation

- **Status:** Accepted
- **Date:** 2026-07-22
- **Deciders:** Atlas AI project team

## Context

File System Access already sandboxed paths (`assertAllowed` roots + deny list)
and, when platform services are bootstrapped, wrapped `os.files` with the OS
Permission Broker (ADR-0066). Product APIs still did not call
`PermissionManager` before operations, and path denials / privileged mutations
were unlogged. Tools declare capabilities, but executor checks remain opt-in.

## Decision

1. Inject optional `permissions?: PermissionManager` and `logger?: Logger` into
   `FileAccessService` / `bootstrapFileAccessFromRegistry`.
2. Authorize **once per public method** via `requestPermission` before path
   work. Capability map:
   - read/navigate/search/metadata → `filesystem.read`
   - write/create/copy → `filesystem.write`
   - delete → `filesystem.delete`
   - move / rename / restore → both `filesystem.write` and `filesystem.delete`
3. On block → `PlatformError` `permission_denied` (same shape as broker,
   including optional `approvalId`). Omit `permissions` in pure memory-FS unit
   tests (path sandbox still applies).
4. Security logs (`platformSecurityLog`): warn on capability/path deny; info on
   allowed mutating ops. Never log file contents.
5. CLI passes the shared `PermissionManager` + filesystem child logger; FS caps
   remain pre-granted for usability.
6. OS Permission Broker stays defense-in-depth on brokered `os.files`.

## Consequences

### Positive

- Unauthorized product FS ops fail clearly before IO.
- Privileged allow/deny are observable in security logs.
- Same capability model as tools and the OS broker.

### Negative / trade-offs

- CLI pre-grants still bypass interactive approval UX.
- No durable audit store beyond Logger + in-memory decision log.
- Raw injected `files` in tests still bypasses the broker (by design).

## Related

- [File-System-Access.md](../guides/File-System-Access.md)
- [ADR-0066](./0066-os-permission-broker.md)
- [ADR-0014](./0014-permission-management-foundation.md)
- [ADR-0074](./0074-file-system-access-service.md)
