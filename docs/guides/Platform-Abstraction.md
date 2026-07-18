# Atlas AI — Platform Abstraction

Host OS services behind shared interfaces so Windows, macOS, and Linux can be
supported without changing business logic (Architecture/11 Platform Abstraction
Layer, Architecture/26 OS Adapter Interface).

Related: [Desktop-Shell.md](./Desktop-Shell.md), [Security.md](./Security.md),
[Configuration.md](./Configuration.md),
[Architecture/11](../Architecture/11-Desktop-Application-Architecture.md),
[Architecture/26](../Architecture/26-Computer-Interaction-Architecture.md),
[ADR-0060](../adr/0060-platform-abstraction.md),
[`@atlas-ai/platform`](../../packages/platform/).

---

## Goals

- Define common interfaces for host OS services (identity, paths, env, fs)
- Isolate platform-specific implementations (darwin / linux / win32)
- Load the correct adapter at runtime via `PlatformManager`
- Keep `@atlas-ai/core` free of direct `process` / `os` / `fs` calls

---

## Architecture

```
Atlas packages (core, config, CLI, …)
              │
       PlatformManager
              │
       PlatformServices
       ├── PlatformInfo
       ├── PathService
       ├── EnvService
       └── FsService
              │
     Node darwin / linux / win32 adapters
```

Computer-control tools (`openApplication`, `executeCommand`, screen capture)
are **out of scope** here — they belong to MVP Phase 4 / `@atlas-ai/tools` on
top of this layer. OS keychain adapters use existing
`SecureStorageProvider` in `@atlas-ai/security`.

---

## Usage

```ts
import {
  createPlatformManager,
  getDefaultPlatformManager,
  resolvePlatformPaths,
} from "@atlas-ai/platform";

const manager = createPlatformManager(); // detects process.platform
const { info, paths, env, fs } = manager.getServices();

info.id; // "darwin" | "linux" | "win32"
paths.userDataDir(); // OS-specific Atlas data root

// Tests / DI
const win = createPlatformManager({
  platformId: "win32",
  services: {/* override PathService, etc. */},
});

// Opt-in absolute layout under userDataDir (does not change CLI `.data` defaults)
const layout = resolvePlatformPaths(manager.getServices());
```

`ContextManager` accepts optional `platform: PlatformInfo`. When omitted, core
uses `getDefaultPlatformManager()`.

---

## Path defaults

| Platform | userDataDir                                      | cacheDir                                    |
| -------- | ------------------------------------------------ | ------------------------------------------- |
| darwin   | `~/Library/Application Support/Atlas`            | `~/Library/Caches/Atlas`                    |
| linux    | `$XDG_DATA_HOME/atlas` or `~/.local/share/atlas` | `$XDG_CACHE_HOME/atlas` or `~/.cache/atlas` |
| win32    | `%APPDATA%\Atlas`                                | `%LOCALAPPDATA%\Atlas\Cache`                |

CLI / config still default to relative `.data` and `models` for local-dev
compatibility. Desktop (and future `ATLAS_USE_USER_DATA`) should call
`resolvePlatformPaths`.

---

## Commands

```bash
pnpm platform:build
pnpm exec vitest run packages/platform
```
