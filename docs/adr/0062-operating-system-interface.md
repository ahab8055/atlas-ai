# ADR-0062: Common operating system interface

- **Status:** Accepted
- **Date:** 2026-07-19
- **Deciders:** Atlas AI project team

## Context

ADR-0060/0061 delivered host paths, env, fs helpers, and platform detection.
Architecture/11 and Architecture/26 require a unified OS Adapter Interface for
application management, files, terminal, notifications, clipboard, and system
information so business logic never calls OS APIs directly. Tools still stub
computer actions; modules need a stable TypeScript contract to depend on now.

## Decision

1. Add an **`OperatingSystem`** facade on `PlatformServices.os` with capability
   interfaces: `ApplicationService`, `FileSystemService`, `TerminalService`,
   `NotificationService`, `ClipboardService`, `SystemInformationService`, plus
   existing `PathService` / `EnvService`.
2. Node adapters ship **real** `FileSystemService` + `SystemInformationService`
   (from `PlatformInfo`); application / terminal / notification / clipboard are
   **stubs** that throw `PlatformError` with `code: "not_implemented"` until
   Phase 4.
3. `PlatformManager` always attaches `os`; callers may DI-override
   `os?: Partial<OperatingSystem>` or `services.os` without changing business
   logic.
4. Future OS modules and tools must depend only on these interfaces—not
   `node:child_process`, clipboard APIs, or shell helpers directly.

## Consequences

### Positive

- Single API surface for all OS capabilities.
- Implementations are swappable via DI.
- Files + system info usable immediately; computer-control contract is fixed.

### Negative / trade-offs

- Stubs mean runtime failures until Phase 4 adapters land—callers must handle
  `PlatformError`.
- Thin legacy `FsService` remains for backward compatibility alongside
  `OperatingSystem.files`.

## Related

- [Platform-Abstraction.md](../guides/Platform-Abstraction.md)
- [ADR-0060](./0060-platform-abstraction.md)
- [ADR-0061](./0061-platform-detection.md)
- [Architecture/26](../Architecture/26-Computer-Interaction-Architecture.md)
