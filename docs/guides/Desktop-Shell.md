# Atlas AI — Desktop Application Shell

Foundation desktop shell (Tauri 2 + React + TypeScript).

Related: [Architecture/11-Desktop-Application-Architecture.md](../Architecture/11-Desktop-Application-Architecture.md),
[Platform-Abstraction.md](./Platform-Abstraction.md),
[ADR-0060](../adr/0060-platform-abstraction.md).

---

## What this foundation provides

| Piece               | Location                                                              |
| ------------------- | --------------------------------------------------------------------- |
| Native window       | `apps/desktop/src-tauri/tauri.conf.json` (`label: main`)              |
| Lifecycle           | Rust `lifecycle.rs` (initialize → ready → running → shutdown)         |
| Frontend lifecycle  | `useAppLifecycle` (mount → IPC handshake → ready)                     |
| Typed IPC           | `get_app_info`, `ping` via `src/lib/ipc`                              |
| Extensible UI shell | `features/shell` with slots for Assistant / Memory / Tools / Settings |

---

## Structure

```
apps/desktop/
├── src/
│   ├── App.tsx
│   ├── features/shell/     # layout + home + status
│   ├── hooks/              # useAppLifecycle
│   └── lib/ipc/            # typed invoke client
└── src-tauri/
    ├── src/
    │   ├── lib.rs
    │   ├── lifecycle.rs
    │   └── commands/       # add modules here as Atlas grows
    └── tauri.conf.json
```

---

## Run

```bash
pnpm logging:build   # if logging package changed
pnpm dev             # full Tauri shell (required for IPC)
pnpm dev:web         # UI only — IPC will show "unreachable"
```

---

## Adding a future module

1. **Rust:** new file under `src-tauri/src/commands/`, register in `lib.rs` `generate_handler!`.
2. **TS:** add wrapper in `src/lib/ipc/client.ts`.
3. **UI:** replace a “soon” nav slot under `features/` (e.g. `features/chat/`).

---

## Lifecycle

```
Initialize (Rust setup) → Ready → Running
                ↑
UI: mounting → connecting (IPC) → ready
```

Shutdown is logged on window close / exit events.
