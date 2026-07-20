# ADR-0071: Platform logging and diagnostics

- **Status:** Accepted
- **Date:** 2026-07-20
- **Deciders:** Atlas AI project team

## Context

Platform lifecycle, permission, and provider failures reached the EventBus
(ADR-0069) but not Atlas structured logs. When `platformEvents` was disabled,
diagnostics were missing entirely. Developers needed init / provider load /
permission / failure / service lifecycle records in the same sinks as the rest
of Atlas, with `PlatformError.detail` for troubleshooting.

## Decision

1. Add optional **`logger?: Logger`** (`@atlas-ai/logging`) on
   `PlatformManagerOptions` / `OsPermissionBrokerOptions` (and via bootstrap /
   `toPlatformManagerOptions` extras).
2. Emit structured logs at the same sites as ADR-0069 events:
   - provider loaded + initialized (`info`); broker wrap (`debug`)
   - services started (`info`)
   - permission denied (`warn`, category `security`); allowed (`debug`)
   - provider failed (`logError` + `detail` in context)
3. Keep events and logs independent — logs still emit when events are off.
4. Enrich **`PlatformProviderFailed`** payload with optional `detail`.
5. CLI injects `logger.child("platform")` at bootstrap.
6. No logger → silent (unit tests stay quiet by default).

## Consequences

### Positive

- Platform issues visible in Atlas logs with errno/syscall/path context.
- Aligns with optional-logger DI used by AI and memory packages.

### Negative / trade-offs

- New `@atlas-ai/logging` dependency on platform.
- Allowed permission checks only at `debug` to limit noise.

## Related

- [Platform-Abstraction.md](../guides/Platform-Abstraction.md)
- [Logging.md](../guides/Logging.md)
- [ADR-0004](./0004-structured-logging.md)
- [ADR-0069](./0069-platform-event-integration.md)
- [ADR-0068](./0068-os-error-translation.md)
