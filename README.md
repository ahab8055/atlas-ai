# Atlas AI

Local-first personal AI assistant. Privacy-focused, modular, and designed to run on your machine.

## Repository structure

```
atlas-ai/
├── apps/desktop/     # Desktop application (Tauri)
├── packages/         # core, agents, tools, memory, database, shared, config
├── config/           # Non-secret per-environment defaults
├── models/           # Local AI model weights
├── docs/             # Product, architecture, guides, ADRs
├── scripts/          # Developer tooling
└── tests/            # Cross-cutting tests
```

## Development setup

New contributors should start here:

**[docs/guides/Development-Setup.md](docs/guides/Development-Setup.md)**  
**[docs/README.md](docs/README.md)** — full documentation map

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

See **[docs/guides/Version-Control.md](docs/guides/Version-Control.md)** for branching (`main` + short-lived `feature/*` / `fix/*` / …) and **[docs/guides/Code-Quality-Standards.md](docs/guides/Code-Quality-Standards.md)** for Conventional Commits.

## Documentation

| Doc                                                               | Description                  |
| ----------------------------------------------------------------- | ---------------------------- |
| [Documentation hub](docs/README.md)                               | Structure & navigation       |
| [MVP Plan](docs/product/MVP-Plan.md)                              | MVP scope and phases         |
| [Technology Stack](docs/product/Technology-Stack-Architecture.md) | Stack decisions              |
| [Development Setup](docs/guides/Development-Setup.md)             | Local environment            |
| [Code Quality Standards](docs/guides/Code-Quality-Standards.md)   | Formatting, linting, commits |
| [Version Control](docs/guides/Version-Control.md)                 | Git branching & workflow     |
| [Configuration](docs/guides/Configuration.md)                     | Env profiles & secrets       |
| [Logging](docs/guides/Logging.md)                                 | Structured logging           |
| [Testing](docs/guides/Testing.md)                                 | Vitest & test layout         |
| [Architecture index](docs/Architecture/README.md)                 | Technical design docs        |
| [ADRs](docs/adr/README.md)                                        | Architecture decisions       |

## License

See [LICENSE](LICENSE).
