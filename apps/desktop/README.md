# Atlas AI desktop application

Tauri 2 + React + TypeScript shell for Atlas AI.

## Commands (from repo root)

| Command              | Description                        |
| -------------------- | ---------------------------------- |
| `pnpm dev`           | Start desktop app (`tauri dev`)    |
| `pnpm dev:web`       | Vite frontend only (no Rust shell) |
| `pnpm build`         | Build frontend (`tsc` + Vite)      |
| `pnpm build:desktop` | Production Tauri bundle            |
| `pnpm check:rust`    | Compile-check Rust backend         |

From this package:

```bash
pnpm tauri:dev
pnpm build
pnpm check:rust
```

See [docs/Development-Setup.md](../../docs/Development-Setup.md) for toolchain prerequisites.
