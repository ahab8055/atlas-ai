# Atlas AI desktop application

Tauri 2 + React + TypeScript **foundation shell** for Atlas AI.

See [docs/guides/Desktop-Shell.md](../../docs/guides/Desktop-Shell.md).

## Commands (from repo root)

| Command              | Description                                |
| -------------------- | ------------------------------------------ |
| `pnpm dev`           | Start desktop app (`tauri dev`) — full IPC |
| `pnpm dev:web`       | Vite frontend only (no Rust shell)         |
| `pnpm build`         | Build frontend (+ packages)                |
| `pnpm build:desktop` | Production Tauri bundle                    |
| `pnpm check:rust`    | Compile-check Rust backend                 |

## IPC (foundation)

| Command        | Purpose                         |
| -------------- | ------------------------------- |
| `get_app_info` | Name, version, foundation phase |
| `ping`         | Connectivity probe              |

Typed wrappers: `src/lib/ipc`.
