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
[ADR-0064](../adr/0064-macos-platform-provider.md),
[ADR-0065](../adr/0065-linux-platform-provider.md),
[ADR-0066](../adr/0066-os-permission-broker.md),
[ADR-0067](../adr/0067-platform-service-registry.md),
[ADR-0068](../adr/0068-os-error-translation.md),
[ADR-0069](../adr/0069-platform-event-integration.md),
[ADR-0070](../adr/0070-platform-configuration-management.md),
[ADR-0071](../adr/0071-platform-logging-diagnostics.md),
[ADR-0072](../adr/0072-platform-unit-testing.md),
[`@atlas-ai/platform`](../../packages/platform/).

---

## Goals

- Define a common **`OperatingSystem`** facade (apps, files, terminal, notify,
  clipboard, system info, paths, env)
- Detect OS, architecture, kernel, and runtime via `PlatformDetector`
- Isolate platform-specific implementations (darwin / linux / win32)
- Load the correct adapter at runtime via `PlatformManager`
- Resolve services via **`PlatformServiceRegistry`** (loose coupling)
- Keep business logic free of direct `process` / `os` / `fs` / shell calls

---

## Architecture

```
Atlas packages (tools / core / desktop)
              │
       PlatformServiceRegistry  ← resolve("os") / getOs()
              │
       PlatformManager  (factory)
              │
       OsPermissionBroker ──► PermissionManager (audit + approvals)
              │
       PlatformDetector ──► OsProbe (Node)
              │
       PlatformServices
       ├── PlatformInfo
       ├── PathService / EnvService / FsService (legacy thin fs)
       └── OperatingSystem  (preferred API; privileged methods gated)
              ├── applications / files / terminal / notifications / clipboard
              ├── system        (PlatformInfo + hostname/uptime)
              ├── paths / env   (ungated infra)
```

**Rule:** future OS modules depend only on these interfaces. Resolve via
`PlatformServiceRegistry` (or inject `PlatformServices`); do not import
darwin/linux/win32 providers. Swap implementations via `PlatformManager` DI
(`os?: Partial<OperatingSystem>`) then `register({ replace: true })`.

Privileged OS calls go through **`OsPermissionBroker` → `PermissionManager`**
(default on). Tools/ExecutionController also gate via the same permission
framework. OS keychain uses `SecureStorageProvider`. Screen capture is out of
this facade.

---

## Service registry

Register platform services at startup; modules resolve by key or typed getters.

```ts
import { loadConfig } from "@atlas-ai/config";
import {
  bootstrapPlatformServices,
  createPlatformEventPublisher,
  EventBus,
  toPlatformManagerOptions,
} from "@atlas-ai/core";
import { createLogger } from "@atlas-ai/logging";
import { getDefaultPlatformServiceRegistry } from "@atlas-ai/platform";

const config = loadConfig();
const logger = createLogger({ service: "atlas-host" });
const eventBus = new EventBus();
bootstrapPlatformServices({
  ...toPlatformManagerOptions(config.platform, {
    permissionManager: permissions,
    logger: logger.child("platform"),
    onPlatformEvent: config.platform.features.platformEvents
      ? createPlatformEventPublisher(eventBus)
      : undefined,
  }),
});

const registry = getDefaultPlatformServiceRegistry();
const os = registry.getOs();
const apps = registry.resolve("os.applications");
const info = registry.getInfo();
```

Config-driven behaviour (ADR-0070): `config.platform.forcePlatformId`,
`features.osPermissionBroker`, `features.platformEvents`. Paths stay on
`config.paths` — see [Configuration.md](./Configuration.md).

| Key                                    | Type                                  |
| -------------------------------------- | ------------------------------------- |
| `info` / `paths` / `env` / `fs` / `os` | Top-level `PlatformServices`          |
| `os.applications` … `os.env`           | Nested `OperatingSystem` capabilities |

- **Singleton:** `getDefaultPlatformServiceRegistry` /
  `setDefaultPlatformServiceRegistry`
- **DI:** inject `platformRegistry` into the request pipeline, or
  `register({ replace: true })` after building a custom `PlatformManager`
- **Lazy fallback:** if resolve runs before explicit register, services are
  taken once from `getDefaultPlatformManager()`

`PlatformManager` remains the factory (adapter selection + permission wrap).
The registry is the lookup surface only.

Prefer **`FileAccessService`** (`@atlas-ai/filesystem`) for product search /
read / write / move — see [File-System-Access.md](./File-System-Access.md) and
ADR-0074. Use `os.files` directly only for low-level platform plumbing.

---

## OperatingSystem facade

```ts
import { PermissionManager } from "@atlas-ai/security";
import { createPlatformManager, PlatformError } from "@atlas-ai/platform";

const permissions = new PermissionManager({
  grantedCapabilities: ["filesystem.write", "application.control"],
});
const { os } = createPlatformManager({
  permissionManager: permissions,
}).getServices();

os.system.getPlatform(); // L0 — allowed and logged
os.files.writeText("/tmp/a.txt", "hi"); // requires filesystem.write grant

try {
  await os.applications.open("TextEdit");
} catch (e) {
  if (e instanceof PlatformError && e.code === "permission_denied") {
    // approval pending — e.approvalId for future Permission Center dialogs
  }
}
```

### OS permission broker

`PlatformManager` wraps privileged OS methods by default (`enforceOsPermissions:
true`). Unauthorized calls throw `PlatformError` with code `permission_denied`
and optional `approvalId`. Every check is logged on `PermissionManager`.

| OS methods                                             | Capability            |
| ------------------------------------------------------ | --------------------- |
| `applications.*`                                       | `application.control` |
| `terminal.execute`                                     | `terminal.execute`    |
| `files` exists/read/readBytes/list/stat/lstat/readlink | `filesystem.read`     |
| `files` write/mkdirp                                   | `filesystem.write`    |
| `files` remove                                         | `filesystem.delete`   |
| `clipboard.readText`                                   | `clipboard.read`      |
| `clipboard.writeText`                                  | `clipboard.write`     |
| `notifications.show`                                   | `notifications.show`  |
| `system.*`                                             | `system.info` (L0)    |

`paths.*` and `env.*` are not gated (bootstrap/infra).

### Logging and diagnostics

Optional **`logger?: Logger`** from `@atlas-ai/logging` (ADR-0071). Parallel to
platform events — logs still emit when `platformEvents` is false. Distinct from
the PermissionManager **decision log** (security audit of grants/denies).

| Site                                   | Level                  | Notes                                     |
| -------------------------------------- | ---------------------- | ----------------------------------------- |
| Provider loaded / platform initialized | `info`                 | `platformId`, `os`, `arch`                |
| Broker wrap on/off                     | `debug`                | `enforceOsPermissions`                    |
| Services started (bootstrap)           | `info`                 | `via: "bootstrap"`                        |
| Permission denied                      | `warn` (`security`)    | operation, capability, reason, approvalId |
| Permission allowed                     | `debug` (`security`)   | operation, capability                     |
| Provider failed                        | `error` via `logError` | includes `PlatformError.detail`           |

CLI injects `logger.child("platform")`. Failure events also carry optional
`detail` on `PlatformProviderFailed`. See [Logging.md](./Logging.md).

### Platform events

Lifecycle, permission, and provider failures publish through an optional
**`PlatformEventPublisher`** callback (no `@atlas-ai/core` dependency in
platform). The host bridges to `EventBus` via `createPlatformEventPublisher`.

| Event                     | When                                                               |
| ------------------------- | ------------------------------------------------------------------ |
| `PlatformDetected`        | After `PlatformManager.create` builds services                     |
| `PlatformServicesStarted` | After `bootstrapPlatformServices` registers                        |
| `PermissionDenied`        | `OsPermissionBroker` blocks a gated operation                      |
| `PlatformProviderFailed`  | Gated op throws non-permission `PlatformError` (optional `detail`) |

```ts
import { loadConfig } from "@atlas-ai/config";
import {
  bootstrapPlatformServices,
  createPlatformEventPublisher,
  EventBus,
  toPlatformManagerOptions,
} from "@atlas-ai/core";
import { createLogger } from "@atlas-ai/logging";

const config = loadConfig();
const logger = createLogger({ service: "atlas-cli" });
const eventBus = new EventBus();
bootstrapPlatformServices({
  ...toPlatformManagerOptions(config.platform, {
    permissionManager: permissions,
    logger: logger.child("platform"),
    onPlatformEvent: createPlatformEventPublisher(eventBus),
  }),
});

eventBus.subscribe("PermissionDenied", (event) => {
  console.log(event.payload.operation, event.payload.reason);
});
```

Constant: `PLATFORM_EVENTS` in `@atlas-ai/platform` (re-exported from core).
See [Event-System.md](./Event-System.md) and [ADR-0069](../adr/0069-platform-event-integration.md).

```ts
// Raw provider tests — skip broker
createPlatformManager({ enforceOsPermissions: false, platformId: "linux" });
```

Prefer `os.files` over the thin legacy `FsService` for new code.

### Error translation

OS providers throw **`PlatformError`** with a stable code and category. Native
Node errno/spawn failures are mapped by `translateNativeError`.

| Category     | Codes                                        |
| ------------ | -------------------------------------------- |
| `permission` | `permission_denied`                          |
| `resource`   | `resource_not_found`                         |
| `system`     | `io_error`, `not_implemented`, `unsupported` |
| `unknown`    | `invalid_input`, `unknown`                   |

Diagnostics live on `detail` (`errno`, `syscall`, `path`, …) and `cause`
(original native error). Core maps these via `fromPlatformError` into
`AtlasErrorResponse` while keeping `platformCode` / `detail` in `context`.

| Capability    | Interface                    | Node today                                      |
| ------------- | ---------------------------- | ----------------------------------------------- |
| Applications  | `ApplicationService`         | **Windows** + **macOS** + **Linux**             |
| Files         | `FileSystemService`          | real                                            |
| Terminal      | `TerminalService`            | **Windows** + **macOS** + **Linux** (runner)    |
| Notifications | `NotificationService`        | **Windows** + **macOS** + **Linux**             |
| Clipboard     | `ClipboardService`           | **Windows** + **macOS** + **Linux** (fallbacks) |
| System info   | `SystemInformationService`   | real                                            |
| Paths / env   | `PathService` / `EnvService` | real (ungated)                                  |

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

---

## macOS provider

When `PlatformManager` detects (or forces) `darwin`, it auto-loads
`createDarwinOperatingSystem` — no separate registration step.

| Capability                   | Mechanism                                                |
| ---------------------------- | -------------------------------------------------------- |
| `applications.open`          | `open <path>` or `open -a <AppName>`                     |
| `listRunning` / focus / quit | `osascript` System Events / `activate` / `quit` / `kill` |
| `terminal.execute`           | Direct spawn via `DarwinCommandRunner`                   |
| `clipboard`                  | `pbpaste` / `pbcopy` (stdin)                             |
| `notifications.show`         | `osascript` `display notification`                       |

```ts
import { createPlatformManager } from "@atlas-ai/platform";

// On macOS hosts (or platformId: "darwin") — Darwin provider is automatic
const { os } = createPlatformManager({ platformId: "darwin" }).getServices();
await os.applications.open("TextEdit");

// Tests: inject a mock runner (no real macOS binaries required)
createPlatformManager({
  platformId: "darwin",
  darwinRunner: {
    async run(command, args) {
      return { stdout: "", stderr: "", exitCode: 0 };
    },
  },
});
```

---

## Linux provider

When `PlatformManager` detects (or forces) `linux`, it auto-loads
`createLinuxOperatingSystem` — no separate registration step. Desktop and
distro differences use ordered freedesktop CLI fallbacks.

| Capability           | Mechanism                                                     |
| -------------------- | ------------------------------------------------------------- |
| `applications.open`  | Path/URL → `xdg-open`; bare id → `gtk-launch` then `xdg-open` |
| `listRunning`        | `ps -eo pid=,comm=`                                           |
| `focus` / `quit`     | `wmctrl` / `xdotool` (best-effort); `kill` / `pkill -x`       |
| `terminal.execute`   | Direct spawn via `LinuxCommandRunner`                         |
| `clipboard`          | `wl-copy`/`wl-paste`, then `xclip`, then `xsel`               |
| `notifications.show` | `notify-send`                                                 |

```ts
import { createPlatformManager } from "@atlas-ai/platform";

// On Linux hosts (or platformId: "linux") — Linux provider is automatic
const { os } = createPlatformManager({ platformId: "linux" }).getServices();
await os.applications.open("firefox");

// Tests: inject a mock runner (no real Linux binaries required)
createPlatformManager({
  platformId: "linux",
  linuxRunner: {
    async run(command, args) {
      return { stdout: "", stderr: "", exitCode: 0 };
    },
  },
});
```

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

## Testing

### Unit (ADR-0072)

Colocated Vitest under `packages/platform/src/**/*.test.ts`:

- Detection / probe / manager edge cases
- Registry resolve matrix + bootstrap
- OS contracts (focus / quit / notifications + Linux fallbacks) with mock runners
- Config → `toPlatformManagerOptions` + host `platformEvents` wiring
- Permission broker wrap matrix

```bash
pnpm exec vitest run packages/platform
pnpm --filter @atlas-ai/platform test:coverage   # ≥80% lines/functions/statements, ≥70% branches
```

Use `enforceOsPermissions: false` and injectable `*Runner` mocks — no real OS
binaries in unit tests.

### Integration (ADR-0073)

Cross-package suite under `tests/integration/phase4-platform.test.ts` forces
`darwin` / `linux` / `win32` via mock runners on a single CI host. See
[Phase4-Platform-Integration-Testing.md](./Phase4-Platform-Integration-Testing.md).

```bash
pnpm test:integration
pnpm exec vitest run tests/integration/phase4-platform.test.ts
```

---

## Commands

```bash
pnpm platform:build
pnpm exec vitest run packages/platform
pnpm --filter @atlas-ai/platform test:coverage
```
