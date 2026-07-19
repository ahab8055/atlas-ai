# Atlas AI — Platform Abstraction

Host OS services behind shared interfaces so Windows, macOS, and Linux can be
supported without changing business logic (Architecture/11 Platform Abstraction
Layer, Architecture/26 OS Adapter Interface).

Related: [Desktop-Shell.md](./Desktop-Shell.md), [Security.md](./Security.md),
[Configuration.md](./Configuration.md),
[Architecture/11](../Architecture/11-Desktop-Application-Architecture.md),
[Architecture/26](../Architecture/26-Computer-Interaction-Architecture.md),
[ADR-0060](../adr/0060-platform-abstraction.md),
[ADR-0061](../adr/0061-platform-detection.md),
[ADR-0062](../adr/0062-operating-system-interface.md),
[ADR-0063](../adr/0063-windows-platform-provider.md),
[`@atlas-ai/platform`](../../packages/platform/).

---

## Goals

- Define a common **`OperatingSystem`** facade (apps, files, terminal, notify,
  clipboard, system info, paths, env)
- Detect OS, architecture, kernel, and runtime via `PlatformDetector`
- Isolate platform-specific implementations (darwin / linux / win32)
- Load the correct adapter at runtime via `PlatformManager`
- Keep business logic free of direct `process` / `os` / `fs` / shell calls

---

## Architecture

```
Atlas packages (tools / core / desktop)
              │
       PlatformManager
              │
       PlatformDetector ──► OsProbe (Node)
              │
       PlatformServices
       ├── PlatformInfo
       ├── PathService / EnvService / FsService (legacy thin fs)
       └── OperatingSystem  (preferred API)
              ├── applications  (stub → Phase 4)
              ├── files         (Node)
              ├── terminal      (stub → Phase 4)
              ├── notifications (stub → Phase 4)
              ├── clipboard     (stub → Phase 4)
              ├── system        (PlatformInfo + hostname/uptime)
              ├── paths / env
```

**Rule:** future OS modules depend only on these interfaces. Swap
implementations via `PlatformManager` DI (`os?: Partial<OperatingSystem>`).

Permission gating stays in `@atlas-ai/security` + tool executor. OS keychain
uses `SecureStorageProvider`. Screen capture is out of this facade.

---

## OperatingSystem facade

```ts
import { createPlatformManager, PlatformError } from "@atlas-ai/platform";

const { os } = createPlatformManager().getServices();

os.system.getPlatform(); // enriched PlatformInfo
os.files.writeText("/tmp/a.txt", "hi");

try {
  await os.applications.open("TextEdit");
} catch (e) {
  if (e instanceof PlatformError && e.code === "not_implemented") {
    // Phase 4 adapter not wired yet
  }
}

// DI: swap one capability without rewriting callers
createPlatformManager({
  os: {
    clipboard: {
      readText: async () => "test",
      writeText: async () => undefined,
    },
  },
});
```

| Capability    | Interface                    | Node today                                                    |
| ------------- | ---------------------------- | ------------------------------------------------------------- |
| Applications  | `ApplicationService`         | **Windows:** `cmd start` / PowerShell; darwin/linux: stub     |
| Files         | `FileSystemService`          | real                                                          |
| Terminal      | `TerminalService`            | **Windows:** process spawn via runner; darwin/linux: stub     |
| Notifications | `NotificationService`        | **Windows:** PowerShell balloon; darwin/linux: stub           |
| Clipboard     | `ClipboardService`           | **Windows:** `Get-Clipboard` / `clip.exe`; darwin/linux: stub |
| System info   | `SystemInformationService`   | real                                                          |
| Paths / env   | `PathService` / `EnvService` | real                                                          |

Prefer `os.files` over the thin legacy `FsService` for new code.

---

## Windows provider

When `PlatformManager` detects (or forces) `win32`, it auto-loads
`createWindowsOperatingSystem` — no separate registration step.

| Capability                   | Mechanism                                                 |
| ---------------------------- | --------------------------------------------------------- |
| `applications.open`          | `cmd.exe /c start "" <target>`                            |
| `listRunning` / focus / quit | PowerShell `Get-Process` / `AppActivate` / `Stop-Process` |
| `terminal.execute`           | Direct spawn via `WindowsCommandRunner`                   |
| `clipboard`                  | `Get-Clipboard` / `clip.exe` (Set-Clipboard fallback)     |
| `notifications.show`         | PowerShell `NotifyIcon` balloon                           |

```ts
import { createPlatformManager } from "@atlas-ai/platform";

// On Windows hosts (or platformId: "win32") — Windows provider is automatic
const { os } = createPlatformManager({ platformId: "win32" }).getServices();
await os.applications.open("notepad");

// Tests: inject a mock runner (no real Windows binaries required)
createPlatformManager({
  platformId: "win32",
  windowsRunner: {
    async run(command, args) {
      return { stdout: "", stderr: "", exitCode: 0 };
    },
  },
});
```

Darwin/Linux computer-control providers are follow-ups; until then those hosts
use `not_implemented` stubs for apps/terminal/clipboard/notifications.

---

## Platform detection

```ts
import {
  createPlatformDetector,
  createPlatformManager,
} from "@atlas-ai/platform";

const info = createPlatformDetector().detect();
// info.id, info.os, info.arch, info.kernelVersion, info.runtime.version

createPlatformManager().getServices().os.system.getPlatform();
```

| Field           | Source                                             |
| --------------- | -------------------------------------------------- |
| `id`            | `process.platform` → darwin / linux / win32        |
| `os`            | Friendly map (darwin→macos, win32→windows)         |
| `arch`          | `os.arch()`                                        |
| `kernelVersion` | `os.release()`                                     |
| `osType`        | `os.type()`                                        |
| `osVersion`     | `os.version()` when available                      |
| `runtime`       | `{ kind: "node", version: process.versions.node }` |

---

## Paths

| Platform | userDataDir                                      | cacheDir                                    |
| -------- | ------------------------------------------------ | ------------------------------------------- |
| darwin   | `~/Library/Application Support/Atlas`            | `~/Library/Caches/Atlas`                    |
| linux    | `$XDG_DATA_HOME/atlas` or `~/.local/share/atlas` | `$XDG_CACHE_HOME/atlas` or `~/.cache/atlas` |
| win32    | `%APPDATA%\Atlas`                                | `%LOCALAPPDATA%\Atlas\Cache`                |

CLI defaults remain relative `.data` / `models`. Use `resolvePlatformPaths` for
absolute user-data layouts.

---

## Commands

```bash
pnpm platform:build
pnpm exec vitest run packages/platform
```
