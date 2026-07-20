# ADR-0072: Platform unit testing and coverage floor

- **Status:** Accepted
- **Date:** 2026-07-20
- **Deciders:** Atlas AI project team

## Context

The OS abstraction layer gained providers, a permission broker, registry,
config mapping, and diagnostics. The team needed automated unit tests so
new platforms and brokers stay reliable, with a measurable coverage floor
for `@atlas-ai/platform` (monorepo-wide thresholds would fail unrelated
packages).

## Decision

1. Keep **colocated Vitest** suites under `packages/platform/src/**/*.test.ts`.
2. Prefer **injectable mock runners** and `enforceOsPermissions: false` for
   raw provider contract tests — no real OS binaries in unit tests.
3. Cover detection, registry, OS contracts (including focus/quit/notifications),
   config → `toPlatformManagerOptions`, and permission-broker wrap matrix.
4. Enforce coverage via
   [`packages/platform/vitest.config.ts`](../../packages/platform/vitest.config.ts):
   lines/functions/statements ≥ **80%**, branches ≥ **70%** (excluding real
   `**/runner.ts` spawn wrappers and type-only modules — unit tests use mock
   runners).
5. Script: `pnpm --filter @atlas-ai/platform test:coverage` (CI step after
   `pnpm test`).

## Consequences

### Positive

- Regression safety for multi-OS providers and the broker gate.
- Coverage gate scoped to platform only.

### Negative / trade-offs

- Real `createNode*CommandRunner` spawn paths remain lightly covered
  (out of scope for unit tests).
- Thresholds may need occasional bumps as surface area grows.

## Related

- [Testing.md](../guides/Testing.md)
- [Platform-Abstraction.md](../guides/Platform-Abstraction.md)
- [ADR-0060](./0060-platform-abstraction.md)
- [ADR-0066](./0066-os-permission-broker.md)
- [ADR-0067](./0067-platform-service-registry.md)
