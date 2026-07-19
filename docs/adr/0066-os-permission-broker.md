# ADR-0066: OS permission broker

- **Status:** Accepted
- **Date:** 2026-07-19
- **Deciders:** Atlas AI project team

## Context

Architecture/26 requires authorization before privileged computer-control
actions. ADR-0014 delivered `PermissionManager`, approvals, and audit logging
for tools/execution. OS providers (ADR-0063–0065) implement apps, files,
terminal, clipboard, and notifications without an OS-level gate, so direct
`os.*` callers could bypass the permission framework. Future Permission Center
dialogs need a stable hook (`approvalId`) when OS ops are blocked.

## Decision

1. Add **`OsPermissionBroker`** in `@atlas-ai/platform` that calls
   `PermissionManager.requestPermission()` before privileged OS methods and
   throws `PlatformError` `permission_denied` (with optional `approvalId`) when
   blocked.
2. **`wrapOperatingSystemWithBroker`** proxies applications, files, terminal,
   notifications, clipboard, and system. Leave `paths` / `env` ungated.
3. **`PlatformManager`** wraps the adapter OS by default
   (`enforceOsPermissions: true`) using
   `permissionBroker` / `permissionManager` / `getDefaultPermissionManager()`.
4. Add capabilities `clipboard.read` (L1), `clipboard.write` (L2),
   `notifications.show` (L1).
5. `@atlas-ai/platform` depends on `@atlas-ai/security` (same pattern as memory).

## Consequences

### Positive

- Unauthorized OS ops are blocked at the platform boundary.
- All OS permission checks reuse existing policy, grants, audit, and approvals.
- `approvalId` on deny enables future approval dialogs without changing providers.
- Providers stay OS-pure; broker is a composition wrap.

### Negative / trade-offs

- Platform depends on security (acceptable; mirrors memory).
- Default enforcement requires grants in hosts/tests that call privileged `os.*`
  through `PlatformManager` (`enforceOsPermissions: false` for raw provider
  tests).

## Related

- [Platform-Abstraction.md](../guides/Platform-Abstraction.md)
- [Security.md](../guides/Security.md)
- [ADR-0014](./0014-permission-management-foundation.md)
- [ADR-0062](./0062-operating-system-interface.md)
- [Architecture/26](../Architecture/26-Computer-Interaction-Architecture.md)
