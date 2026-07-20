# ADR-0073: Phase 4 Platform Abstraction integration tests

- **Status:** Accepted
- **Date:** 2026-07-20
- **Deciders:** Atlas AI project team

## Context

The OS abstraction layer spans darwin / linux / win32 providers, a service
registry, permission broker, standardized `PlatformError`s, and
`PLATFORM_EVENTS` (including the core `EventBus` bridge). Colocated unit tests
(ADR-0072) cover provider contracts and CLI arg shapes. CI runs on a single
`ubuntu-latest` host, so regressions at bootstrap → registry → broker → event
boundaries need a cross-package suite that still exercises every supported
platform without a multi-OS runner matrix.

## Decision

1. Add `tests/integration/phase4-platform.test.ts` with
   `describe.each(["darwin","linux","win32"])` and injectable mock `*Runner`s
   plus forced `platformId` — all providers pass on one CI OS.
2. Add `tests/integration/platform-helpers.ts` with `createPlatformHarness`,
   `assertOperatingSystemCompliance`, `assertPlatformServiceKeyMatrix`, and
   an in-memory / EventBus event collector.
3. Cover: provider load smoke, full service-key resolve, interface compliance,
   thin happy-path OS ops, `PlatformError` / `fromUnknown` mapping, and
   Detected / Started / PermissionDenied / PlatformProviderFailed (including
   EventBus bridge). Add a critical-path smoke on one platform.
4. Do **not** re-assert per-provider CLI arg shapes, run real OS binaries, or
   add Windows/macOS CI runners.
5. Document in `Phase4-Platform-Integration-Testing.md`; run via
   `pnpm test:integration`.

## Consequences

### Positive

- CI proves all three providers load and register without multi-OS hardware.
- Interface compliance and event catalog stay enforced as the surface grows.

### Negative / trade-offs

- Mock runners cannot catch host-specific spawn / PATH issues (unit + manual
  smoke remain for that).

## Related

- [Phase4-Platform-Integration-Testing.md](../guides/Phase4-Platform-Integration-Testing.md)
- [Platform-Abstraction.md](../guides/Platform-Abstraction.md)
- [ADR-0072](./0072-platform-unit-testing.md)
- [ADR-0069](./0069-platform-event-integration.md)
- [ADR-0060](./0060-platform-abstraction.md)
