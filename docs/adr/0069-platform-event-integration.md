# ADR-0069: Platform event integration

- **Status:** Accepted
- **Date:** 2026-07-20
- **Deciders:** Atlas AI project team

## Context

Platform lifecycle (detection, service bootstrap), permission denials, and OS
provider failures needed to reach the internal event bus so modules could
observe host state without importing darwin/linux/win32 providers. `@atlas-ai/core`
already depends on `@atlas-ai/platform`; adding a platform → core dependency
would create a cycle.

## Decision

1. Define **`PLATFORM_EVENTS`** and typed payloads in `@atlas-ai/platform`
   (`packages/platform/src/events.ts`).
2. Emit through an optional **`PlatformEventPublisher`** callback injected via
   `PlatformManagerOptions.onPlatformEvent` (and broker options).
3. Use **`emitPlatformEvent`** helper — no-op when publisher is absent.
4. Emit at locked points:
   - `PlatformDetected` — after `PlatformManager.create` builds services
   - `PlatformServicesStarted` — after `bootstrapPlatformServices` registers
   - `PermissionDenied` — when `OsPermissionBroker` blocks
   - `PlatformProviderFailed` — when gated OS ops throw non-permission
     `PlatformError` (skip `permission_denied`)
5. Bridge in core: **`createPlatformEventPublisher(bus)`** and
   **`publishPlatformEvent`** with `source: "atlas.platform"`.
6. CLI host wires bootstrap with the publisher after creating `EventBus`.

## Consequences

### Positive

- Subscribers use event type strings + payload map only — no provider imports.
- Platform package stays independent of EventBus.
- Hosts (CLI, desktop) opt in by passing a publisher at bootstrap.

### Negative / trade-offs

- Successful permission grants are not emitted (noise).
- No SQLite / distributed persistence in this slice.

## Related

- [Platform-Abstraction.md](../guides/Platform-Abstraction.md)
- [Event-System.md](../guides/Event-System.md)
- [ADR-0016](./0016-event-system-integration.md)
- [ADR-0066](./0066-os-permission-broker.md)
- [ADR-0067](./0067-platform-service-registry.md)
