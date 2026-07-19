# ADR-0063: Windows platform provider

- **Status:** Accepted
- **Date:** 2026-07-19
- **Deciders:** Atlas AI project team

## Context

ADR-0062 defined the common `OperatingSystem` facade with Node stubs for
computer-control. Architecture/26 requires a Windows adapter so Atlas can open
apps, run commands, and use clipboard/notifications reliably on Windows. A
Tauri/Rust Win32 plugin is out of scope for this step; CI must validate the
provider without a Windows host.

## Decision

1. Add a Node **Windows provider** (`createWindowsOperatingSystem`) implementing
   applications, terminal, clipboard, and notifications via
   `cmd.exe` / PowerShell / `clip.exe`, with files/system/paths from existing
   Node helpers.
2. Route all process I/O through an injectable **`WindowsCommandRunner`**
   (`createNodeWindowsCommandRunner` uses `node:child_process.spawn`).
3. **Auto-register** when `PlatformId === "win32"` via
   `createWin32PlatformServices` / `PlatformManager` — no separate registry.
4. Darwin/Linux keep stub computer-control until their providers land.
5. Interface validation tests use a mock runner (CI-safe on macOS/Linux).

## Consequences

### Positive

- Windows-specific behavior behind the shared interface.
- Swappable runner for tests and future Tauri injection.
- Automatic selection on Windows detection.

### Negative / trade-offs

- Relies on CLI/PowerShell rather than pure Win32 FFI (acceptable for MVP Node
  runtime; desktop may later inject native adapters).
- Balloon notifications require Windows Forms assemblies on the target machine.

## Related

- [Platform-Abstraction.md](../guides/Platform-Abstraction.md)
- [ADR-0062](./0062-operating-system-interface.md)
- [Architecture/26](../Architecture/26-Computer-Interaction-Architecture.md)
