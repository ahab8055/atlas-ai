# Atlas AI — Development Setup

Guide for configuring a local development environment so Atlas AI can be built and tested consistently across supported platforms.

**Supported OS:** macOS, Windows, Linux (per Technology Stack / Tauri)

---

## Required software

| Tool        | Version               | Notes                                                           |
| ----------- | --------------------- | --------------------------------------------------------------- |
| **Git**     | 2.x+                  | Version control                                                 |
| **Node.js** | **22.x**              | Pinned in `.nvmrc` / `.node-version` / `package.json` `engines` |
| **pnpm**    | **9.x**               | Monorepo package manager (`packageManager` field)               |
| **Rust**    | **stable** (≥ 1.77.2) | Pinned via `rust-toolchain.toml` (Tauri 2 MSRV)                 |
| **rustup**  | latest                | Installs / manages Rust                                         |

Stack alignment (see [`../product/Technology-Stack-Architecture.md`](../product/Technology-Stack-Architecture.md)):

- Desktop: **Tauri 2** + **React** + **TypeScript** + **Vite**
- Native: **Rust**
- Tooling / packages: **Node.js** + **pnpm**
- Database: **SQLite** (runtime; no separate server)

Optional helpers:

| Tool                                    | Purpose                                             |
| --------------------------------------- | --------------------------------------------------- |
| **nvm** / **fnm** / **asdf** / **mise** | Node version switching (`.nvmrc`, `.tool-versions`) |
| **Xcode CLT** (macOS)                   | Native builds                                       |
| **MSVC Build Tools** (Windows)          | Native Rust builds (MSVC host)                      |
| **WebView2** (Windows)                  | Tauri webview                                       |
| **webkit2gtk 4.1** (Linux)              | Tauri 2 webview                                     |

---

## Quick start

```bash
# 1. Clone
git clone <repository-url> atlas-ai
cd atlas-ai

# 2. Install Node 22 (example with nvm)
nvm install
nvm use

# 3. Enable pnpm (Corepack ships with Node)
corepack enable
corepack prepare pnpm@9.15.9 --activate

# 4. Install Rust (if needed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
# restart shell, then:
rustup show   # should pick up rust-toolchain.toml → stable

# 5. Bootstrap env + install workspace deps
pnpm setup

# 6. Verify toolchain
pnpm check:env
```

---

## Platform prerequisites

### macOS

```bash
xcode-select --install
```

### Windows

1. Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the **Desktop development with C++** workload (MSVC).
2. Install [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/) if not already present.
3. During `rustup` setup, select an **MSVC** host triple (e.g. `x86_64-pc-windows-msvc`).

Use Git Bash, PowerShell, or WSL2. Native Windows + MSVC is the documented Tauri path.

### Linux (Debian/Ubuntu example)

Tauri 2 needs **webkit2gtk 4.1** (not 4.0):

```bash
sudo apt update
sudo apt install -y \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libwebkit2gtk-4.1-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  pkg-config
```

For other distros, follow the [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/).

---

## Environment variables

Secrets and machine-local paths are managed with dotenv-style files and `@atlas-ai/config`.

Full guide: **[Configuration.md](./Configuration.md)**

| File                      | Tracked?            | Purpose                             |
| ------------------------- | ------------------- | ----------------------------------- |
| `config/{env}.json`       | Yes                 | Non-secret defaults per environment |
| `config/{env}.local.json` | **No**              | Optional machine overlays           |
| `.env.example`            | Yes                 | Template of supported variables     |
| `.env`                    | **No** (gitignored) | Local overrides & secrets           |

```bash
cp .env.example .env
```

### Variables

| Variable              | Default                  | Description                                       |
| --------------------- | ------------------------ | ------------------------------------------------- |
| `ATLAS_ENV`           | `development`            | `development` \| `production` \| `test`           |
| `ATLAS_LOG_LEVEL`     | from `config/{env}.json` | `error` \| `warn` \| `info` \| `debug` \| `trace` |
| `ATLAS_DATA_DIR`      | `.data`                  | Local app data (caches, logs)                     |
| `ATLAS_MODELS_DIR`    | `models`                 | Local model weights directory                     |
| `ATLAS_DATABASE_PATH` | `.data/atlas.db`         | SQLite database path                              |
| `OPENAI_API_KEY`      | _(empty)_                | Secret — optional; never in JSON                  |
| `ANTHROPIC_API_KEY`   | _(empty)_                | Secret — optional; never in JSON                  |
| `VITE_ATLAS_API_URL`  | _(commented)_            | Public frontend URL only (no secrets)             |

**Rules:**

- Do not commit `.env` or API keys.
- Do not store secrets in `config/*.json`.
- Prefer local paths under the repo for development.
- Model weight files under `models/` are gitignored; the directory itself is kept.

---

## Repository layout (development-relevant)

```
atlas-ai/
├── apps/desktop/           # Tauri 2 + React + TypeScript app
│   ├── src/                # React frontend
│   └── src-tauri/          # Rust backend (Tauri)
├── packages/               # core, agents, tools, memory, database, shared
├── models/                 # local weights (gitignored contents)
├── docs/                   # product, Architecture, PRD, guides, adr (see docs/README.md)
├── scripts/                # setup and environment helpers
├── tests/                  # cross-cutting / e2e tests
├── Cargo.toml              # Rust workspace root
├── .env.example
├── package.json            # pnpm workspace root + scripts
├── pnpm-workspace.yaml
└── rust-toolchain.toml
```

---

## Common commands

| Command                               | Description                                       |
| ------------------------------------- | ------------------------------------------------- |
| `pnpm setup`                          | Create `.env`, ensure data dirs, `pnpm install`   |
| `pnpm check:env`                      | Validate Node, pnpm, Rust, and OS toolchain hints |
| `pnpm install`                        | Install workspace dependencies                    |
| `pnpm dev`                            | Start Atlas desktop (`tauri dev` + Vite)          |
| `pnpm dev:web`                        | Frontend only on http://localhost:1420            |
| `pnpm build`                          | Typecheck + Vite production build                 |
| `pnpm build:desktop`                  | Production Tauri installer/bundle                 |
| `pnpm check:rust`                     | Compile-check the Rust backend                    |
| `pnpm preview`                        | Preview the built frontend                        |
| `pnpm format` / `pnpm format:check`   | Prettier write / check                            |
| `pnpm lint` / `pnpm lint:fix`         | ESLint                                            |
| `pnpm format:rust` / `pnpm lint:rust` | rustfmt / Clippy                                  |
| `pnpm check:quality`                  | All format + lint gates                           |
| `pnpm check`                          | Quality + Rust check + frontend build             |

Package-level scripts live in `apps/desktop` (`@atlas-ai/desktop`).

Coding standards (naming, folders, commits): [`Code-Quality-Standards.md`](./Code-Quality-Standards.md).

Git branching and workflow: [`Version-Control.md`](./Version-Control.md).

---

## Troubleshooting

**Wrong Node version**  
Use `nvm use` / `fnm use` / `mise install` so the shell matches `.nvmrc` (22.x). `engine-strict=true` in `.npmrc` rejects other majors.

**pnpm version mismatch**  
Run `corepack prepare pnpm@9.15.9 --activate` so it matches `packageManager` in `package.json`.

**`cargo: command not found`**  
Rust lives in `~/.cargo/bin`. Project scripts add it via `scripts/with-cargo-path.sh`. For interactive shells, add this to `~/.zshrc` (or `~/.bashrc`), then open a new terminal:

```bash
. "$HOME/.cargo/env"
```

**Rust not picking up toolchain file**  
From the repo root run `rustup show`. Install with `rustup toolchain install stable` if needed.

**Linux Tauri build fails on webkit**  
Confirm `webkit2gtk-4.1` devel packages are installed (Tauri 2 requirement).

**`.env` not loaded**  
Ensure the file exists at the repo root (not only `.env.example`). Apps will wire loading when packages are implemented.

---

## Related documents

- [`../product/MVP-Plan.md`](../product/MVP-Plan.md) — Phase 0 Foundation Setup
- [`../product/Technology-Stack-Architecture.md`](../product/Technology-Stack-Architecture.md) — stack choices
- [`../Architecture/17-Technology-Stack.md`](../Architecture/17-Technology-Stack.md) — tooling (pnpm, Cargo, GitHub Actions)
- [`../Architecture/19-Development-Plan.md`](../Architecture/19-Development-Plan.md) — foundation tasks
- [`../README.md`](../README.md) — documentation hub
