# ADR-0065: Linux platform provider

- **Status:** Accepted
- **Date:** 2026-07-19
- **Deciders:** Atlas AI project team

## Context

ADR-0062 defined the common `OperatingSystem` facade; ADR-0063 and ADR-0064
shipped Windows and macOS providers. Architecture/26 requires a Linux adapter
so Atlas can open apps, run commands, and use clipboard/notifications across
major distributions and desktop environments. Distro/DE differences must be
handled without native DE plugins; CI must validate without a Linux host for
every assertion (mock runner).

## Decision

1. Add a Node **Linux provider** (`createLinuxOperatingSystem`) implementing
   applications, terminal, clipboard, and notifications via freedesktop-oriented
   CLIs (`xdg-open`, `gtk-launch`, `ps`, `notify-send`, clipboard tools), with
   files/system/paths from existing Node helpers (XDG paths).
2. Route all process I/O through an injectable **`LinuxCommandRunner`**
   (`createNodeLinuxCommandRunner` uses `node:child_process.spawn`).
3. **Auto-register** when `PlatformId === "linux"` via
   `createLinuxPlatformServices` / `PlatformManager` — no separate registry.
4. Handle DE/session differences with **ordered fallbacks**: clipboard prefers
   Wayland (`wl-copy`/`wl-paste`) when `WAYLAND_DISPLAY` or
   `XDG_SESSION_TYPE=wayland`, else `xclip` then `xsel`; focus uses `wmctrl` /
   `xdotool` when available and surfaces clear `io_error` when not.
5. Interface validation tests use a mock runner (CI-safe on macOS/Windows).

## Consequences

### Positive

- Linux-specific behavior behind the shared interface.
- Works across common GNOME/KDE/XFCE-style desktops without DE-specific code.
- Swappable runner for tests and future native injection.
- Automatic selection on Linux detection.

### Negative / trade-offs

- Relies on optional host packages (`wmctrl`, `xdotool`, clipboard tools);
  missing tools yield `io_error` rather than silent no-ops.
- Window focus on pure Wayland without those tools remains best-effort.
- Not a substitute for DBus/GTK native bindings (acceptable for MVP Node
  runtime).

## Related

- [Platform-Abstraction.md](../guides/Platform-Abstraction.md)
- [ADR-0062](./0062-operating-system-interface.md)
- [ADR-0063](./0063-windows-platform-provider.md)
- [ADR-0064](./0064-macos-platform-provider.md)
- [Architecture/26](../Architecture/26-Computer-Interaction-Architecture.md)
