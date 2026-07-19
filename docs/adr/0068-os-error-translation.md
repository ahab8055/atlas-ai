# ADR-0068: OS error translation framework

- **Status:** Accepted
- **Date:** 2026-07-19
- **Deciders:** Atlas AI project team

## Context

OS providers threw `PlatformError` with a small code set, but Node errno/spawn
failures were collapsed to generic `io_error` with only the message string.
Core’s pipeline catch forced `pipeline_error`, discarding platform codes.
Developers needed standardized categories (permission / resource / system /
unknown) and preserved diagnostics for debugging across darwin/linux/win32.

## Decision

1. Expand **`PlatformError`** with `category`, optional `detail`, and `cause`.
2. Add codes `resource_not_found` and `unknown`; map codes to categories.
3. Add **`translateNativeError`** for Node `ErrnoException` (ENOENT → resource,
   EACCES/EPERM → permission, etc.) and wire it into runners + Node FS.
4. Throw `PlatformError("unsupported")` from `detectPlatformId` for unknown
   hosts.
5. Add **`fromPlatformError`** in core; `fromUnknown` recognizes PlatformError;
   pipeline catch preserves platform classification.

## Consequences

### Positive

- Consistent OS failure surface across providers.
- Diagnostics available for debugging without leaking into user messages.
- Atlas error handler can route permission/resource failures correctly.

### Negative / trade-offs

- Call sites that still construct `PlatformError("io_error", …)` for non-errno
  failures remain valid; gradual migration to translator is preferred for
  native catches only.

## Related

- [Platform-Abstraction.md](../guides/Platform-Abstraction.md)
- [Error-Handling.md](../guides/Error-Handling.md)
- [ADR-0020](./0020-error-handling-framework.md)
- [ADR-0062](./0062-operating-system-interface.md)
- [ADR-0066](./0066-os-permission-broker.md)
