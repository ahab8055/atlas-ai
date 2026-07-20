# ADR-0070: Platform configuration management

- **Status:** Accepted
- **Date:** 2026-07-20
- **Deciders:** Atlas AI project team

## Context

Platform behaviour (permission broker wrap, test adapter forcing, event
publishing) was only configurable via code `PlatformManagerOptions`. Users and
CI needed JSON/env overrides loaded at startup without recompiling, matching
ADR-0003’s single `loadConfig` path. ADR-0060 keeps CLI data paths on
`config.paths` (relative); platform must not dual-own path layout.

## Decision

1. Add **`AtlasConfig.platform`** (`AtlasPlatformConfig`) with:
   - optional `forcePlatformId` (test/CI adapter override)
   - `features.osPermissionBroker` / `features.platformEvents`
2. Map via duck-typed **`toPlatformManagerOptions`** in `@atlas-ai/platform`
   (no platform → config package dependency).
3. CLI bootstrap: `loadConfig` → `toPlatformManagerOptions(config.platform, …)`
   → `bootstrapPlatformServices`; gate `onPlatformEvent` on `platformEvents`.
4. Env: `ATLAS_PLATFORM_FORCE_ID`, `ATLAS_PLATFORM_FEATURE_OS_PERMISSION_BROKER`,
   `ATLAS_PLATFORM_FEATURE_EVENTS`.
5. Path customization remains `config.paths` / `ATLAS_DATA_DIR` (ADR-0060).

## Consequences

### Positive

- Platform behaviour customizable via JSON / `.local.json` / env without rebuild.
- Consistent with other Atlas config domains; secrets stay out of platform JSON.
- Test env can force `linux` adapter via `config/test.json`.

### Negative / trade-offs

- Process restart required to reload (same as other Atlas settings).
- Runners / probe / partial OS replacements stay code DI only.

## Related

- [Configuration.md](../guides/Configuration.md)
- [Platform-Abstraction.md](../guides/Platform-Abstraction.md)
- [ADR-0003](./0003-configuration-management.md)
- [ADR-0060](./0060-platform-abstraction.md)
- [ADR-0066](./0066-os-permission-broker.md)
- [ADR-0069](./0069-platform-event-integration.md)
