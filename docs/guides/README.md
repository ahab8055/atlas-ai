# Development guides

Practical guides for contributing to Atlas AI.

| Guide                                                            | Description                                |
| ---------------------------------------------------------------- | ------------------------------------------ |
| [Development-Setup.md](./Development-Setup.md)                   | Toolchain, env vars, OS prerequisites      |
| [Configuration.md](./Configuration.md)                           | Config loading, env profiles, secrets      |
| [Logging.md](./Logging.md)                                       | Structured logs, levels, error format      |
| [Testing.md](./Testing.md)                                       | Vitest, Rust tests, e2e placeholder        |
| [CI-CD.md](./CI-CD.md)                                           | GitHub Actions PR quality gates            |
| [Desktop-Shell.md](./Desktop-Shell.md)                           | Tauri shell, IPC, lifecycle                |
| [Security.md](./Security.md)                                     | Permissions, approvals, secrets            |
| [Request-Pipeline.md](./Request-Pipeline.md)                     | Core request stages + CLI adapter          |
| [CLI.md](./CLI.md)                                               | Terminal adapter, REPL, debug mode         |
| [Database.md](./Database.md)                                     | SQLite init, core tables, repositories     |
| [Task-History.md](./Task-History.md)                             | Queryable task execution history           |
| [Event-System.md](./Event-System.md)                             | Internal event bus + core events           |
| [Response-Generation.md](./Response-Generation.md)               | User-facing responses + voice-ready text   |
| [Error-Handling.md](./Error-Handling.md)                         | Error categories, format, recovery         |
| [Phase1-Integration-Testing.md](./Phase1-Integration-Testing.md) | Cross-package Phase 1 runtime Vitest       |
| [Local-AI-Runtime.md](./Local-AI-Runtime.md)                     | Local inference providers + AI facade      |
| [Model-Registry.md](./Model-Registry.md)                         | Installed model catalog + SQLite persist   |
| [Model-Storage.md](./Model-Storage.md)                           | Model dirs, usage, validate, remove        |
| [Hardware-Detection.md](./Hardware-Detection.md)                 | CPU/RAM/GPU/OS detect + resource tiers     |
| [Hardware-Profiles.md](./Hardware-Profiles.md)                   | low/balanced/performance + recommendations |
| [LlamaCpp-Integration.md](./LlamaCpp-Integration.md)             | GGUF load, CPU/GPU, inference params       |
| [Intent-Detection.md](./Intent-Detection.md)                     | Intent categories, params, registry        |
| [Context-Management.md](./Context-Management.md)                 | Context sources before execution           |
| [Task-Planning.md](./Task-Planning.md)                           | Single- and multi-step execution plans     |
| [Execution-Controller.md](./Execution-Controller.md)             | Lifecycle, progress, failures              |
| [Tool-Registry.md](./Tool-Registry.md)                           | Tool metadata, discovery, versioning       |
| [Tool-Execution.md](./Tool-Execution.md)                         | Validate, run, capture tool results        |
| [Code-Quality-Standards.md](./Code-Quality-Standards.md)         | Naming, format, lint, commits              |
| [Version-Control.md](./Version-Control.md)                       | Branching strategy & Git workflow          |

## Conventions

- One guide per concern; prefer updating these over adding near-duplicates.
- New guides use `Title-Case.md` and must be listed in this index.
- Link to Architecture / PRD / ADRs for design context instead of copying large excerpts.

## Related

- [Documentation hub](../README.md)
- [Architecture Decision Records](../adr/README.md)
