# ADR-0060: Host OS platform abstraction

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** Atlas AI project team

## Context

Atlas must run on Windows, macOS, and Linux without business logic calling OS
APIs directly (Architecture/11 Platform Abstraction Layer; Architecture/26 OS
Adapter Interface). Core already read `process.platform` / `process.arch` for
system state. Paths were cwd-relative (`.data`), which is fine for CLI but not
for desktop user-data dirs. No shared `PlatformManager` existed.

## Decision

1. Add `@atlas-ai/platform` with `PlatformServices` interfaces (`PlatformInfo`,
   `PathService`, `EnvService`, `FsService`).
2. `PlatformManager.create()` detects the host (or accepts `platformId` for
   tests) and loads the matching Node adapter (`darwin` / `linux` / `win32`),
   with DI overrides via `services?: Partial<PlatformServices>`.
3. Migrate `@atlas-ai/core` system-state and degraded pipeline context to use
   `PlatformInfo` / `getDefaultPlatformManager()` — no direct `process.*` for
   platform identity.
4. Provide `resolvePlatformPaths()` for opt-in absolute layouts under
   `userDataDir()`. Do **not** change `DEFAULT_APP_CONFIG` relative paths.
5. Defer computer-control adapters and OS keychain implementations to tools /
   security packages.

## Consequences

### Positive

- Shared interfaces and isolated per-OS adapters.
- Core no longer depends on raw Node process fields for platform identity.
- Desktop can inject Tauri-backed services later without rewriting callers.

### Negative / trade-offs

- Many packages still call `node:fs` directly (model storage, workspace); migrate
  incrementally behind injected roots / `FsService` as needed.
- Relative CLI defaults remain; callers must opt into `resolvePlatformPaths`.

## Related

- [Platform-Abstraction.md](../guides/Platform-Abstraction.md)
- [Architecture/11](../Architecture/11-Desktop-Application-Architecture.md)
- [Architecture/26](../Architecture/26-Computer-Interaction-Architecture.md)
- [ADR-0026](./0026-hardware-detection.md) (`SystemProbe` pattern)
- [ADR-0006](./0006-security-baseline.md) (`SecureStorageProvider`)
