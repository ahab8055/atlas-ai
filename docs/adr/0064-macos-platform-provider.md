# ADR-0064: macOS platform provider

- **Status:** Accepted
- **Date:** 2026-07-19
- **Deciders:** Atlas AI project team

## Context

ADR-0062 defined the common `OperatingSystem` facade; ADR-0063 shipped the
Windows provider. Architecture/26 requires a macOS adapter so Atlas can open
apps, run commands, and use clipboard/notifications on Darwin. Cocoa/AppKit FFI
and Tauri plugins are out of scope for this step; CI must validate the provider
without requiring a macOS host for every assertion (mock runner).

## Decision

1. Add a Node **Darwin provider** (`createDarwinOperatingSystem`) implementing
   applications, terminal, clipboard, and notifications via `open`, `osascript`,
   `pbcopy`/`pbpaste`, with files/system/paths from existing Node helpers.
2. Route all process I/O through an injectable **`DarwinCommandRunner`**
   (`createNodeDarwinCommandRunner` uses `node:child_process.spawn`).
3. **Auto-register** when `PlatformId === "darwin"` via
   `createDarwinPlatformServices` / `PlatformManager` — no separate registry.
4. Linux keeps stub computer-control until its provider lands.
5. Interface validation tests use a mock runner (CI-safe on Linux/Windows).

## Consequences

### Positive

- macOS-specific behavior behind the shared interface.
- Swappable runner for tests and future native injection.
- Automatic selection on Darwin detection.

### Negative / trade-offs

- Relies on CLI/`osascript` rather than Cocoa FFI (acceptable for MVP Node
  runtime; desktop may later inject native adapters).
- Accessibility / Automation permissions may be required for some System Events
  calls on end-user machines.

## Related

- [Platform-Abstraction.md](../guides/Platform-Abstraction.md)
- [ADR-0062](./0062-operating-system-interface.md)
- [ADR-0063](./0063-windows-platform-provider.md)
- [Architecture/26](../Architecture/26-Computer-Interaction-Architecture.md)
