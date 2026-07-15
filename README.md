# Atlas AI

Local-first personal AI assistant. Privacy-focused, modular, and designed to run on your machine.

## Repository structure

```
atlas-ai/
├── apps/desktop/     # Desktop application (Tauri)
├── packages/         # core, agents, tools, memory, database, shared
├── models/           # Local AI model weights
├── docs/             # Product, architecture, and setup docs
├── scripts/          # Developer tooling
└── tests/            # Cross-cutting tests
```

## Development setup

New contributors should start here:

**[docs/Development-Setup.md](docs/Development-Setup.md)**

```bash
corepack enable
pnpm setup
pnpm check:env
pnpm dev
```

| Command              | Description                 |
| -------------------- | --------------------------- |
| `pnpm dev`           | Desktop app (Tauri + React) |
| `pnpm build`         | Frontend production build   |
| `pnpm check:rust`    | Rust compile check          |
| `pnpm build:desktop` | Tauri production bundle     |
| `pnpm check:quality` | Format + lint (TS + Rust)   |
| `pnpm check`         | Full local quality gate     |

## Version control

See **[docs/Version-Control.md](docs/Version-Control.md)** for branching (`main` + short-lived `feature/*` / `fix/*` / …) and **[docs/Code-Quality-Standards.md](docs/Code-Quality-Standards.md)** for Conventional Commits.

## Documentation

| Doc                                                       | Description                  |
| --------------------------------------------------------- | ---------------------------- |
| [MVP Plan](docs/MVP-Plan.md)                              | MVP scope and phases         |
| [Technology Stack](docs/Technology-Stack-Architecture.md) | Stack decisions              |
| [Development Setup](docs/Development-Setup.md)            | Local environment            |
| [Code Quality Standards](docs/Code-Quality-Standards.md)  | Formatting, linting, commits |
| [Version Control](docs/Version-Control.md)                | Git branching & workflow     |

## License

See [LICENSE](LICENSE).
