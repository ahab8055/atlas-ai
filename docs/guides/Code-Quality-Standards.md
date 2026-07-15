# Atlas AI — Code Quality Standards

Development guidelines for consistent, maintainable TypeScript/React and Rust code across the monorepo.

Related tooling: Prettier, ESLint, rustfmt, Clippy, Conventional Commits, Husky + lint-staged.

---

## 1. Naming conventions

### TypeScript / React

| Kind                | Convention                       | Example              |
| ------------------- | -------------------------------- | -------------------- |
| React components    | PascalCase                       | `ChatPanel.tsx`      |
| Hooks               | `use` + PascalCase               | `useAtlasSession.ts` |
| Utilities / modules | camelCase                        | `formatTimestamp.ts` |
| Types / interfaces  | PascalCase                       | `AgentMessage`       |
| Constants           | SCREAMING_SNAKE or camelCase     | `DEFAULT_LOG_LEVEL`  |
| CSS / Tailwind      | utility classes preferred        | —                    |
| Env vars            | `ATLAS_` prefix, SCREAMING_SNAKE | `ATLAS_DATA_DIR`     |

### Rust

| Kind                   | Convention      | Example                   |
| ---------------------- | --------------- | ------------------------- |
| Crates / modules       | snake_case      | `atlas_desktop`, `memory` |
| Functions / variables  | snake_case      | `greet_user`              |
| Types / traits / enums | UpperCamelCase  | `ToolPermission`          |
| Constants              | SCREAMING_SNAKE | `MAX_CONTEXT_TOKENS`      |

### Packages & folders

| Kind               | Convention         | Example                           |
| ------------------ | ------------------ | --------------------------------- |
| Workspace packages | `@atlas-ai/<name>` | `@atlas-ai/desktop`               |
| Directories        | kebab-case         | `apps/desktop`, `packages/shared` |
| Scripts            | kebab-case         | `check-env.sh`                    |

---

## 2. Folder organization

```
atlas-ai/
├── apps/                 # Runnable applications only
│   └── desktop/          # Tauri shell (src = React, src-tauri = Rust)
├── packages/             # Shared libraries (imported by apps)
│   ├── core/
│   ├── agents/
│   ├── tools/
│   ├── memory/
│   ├── database/
│   └── shared/
├── models/               # Local model weights (not source)
├── docs/                 # Product & engineering documentation
├── scripts/              # Repo tooling (bash)
└── tests/                # Cross-cutting integration / e2e only
```

Rules:

- Put **app entry points** under `apps/`.
- Put **reusable libraries** under `packages/`.
- Keep **unit tests next to source** (`*.test.ts`, Rust `#[cfg(test)]`).
- Use `tests/` for **cross-package** or e2e suites.
- Do not place production source at the repo root.
- Prefer one primary concern per package (aligns with modular MVP architecture).

---

## 3. Formatting

| Language                  | Tool         | Config               |
| ------------------------- | ------------ | -------------------- |
| TS / JS / JSON / CSS / MD | **Prettier** | `prettier.config.js` |
| Rust                      | **rustfmt**  | `rustfmt.toml`       |
| Editor basics             | EditorConfig | `.editorconfig`      |

```bash
pnpm format              # Prettier write
pnpm format:check        # Prettier check (CI)
pnpm format:rust         # rustfmt write
pnpm format:rust:check   # rustfmt check (CI)
```

Do not mix formatters for the same language. Disable conflicting IDE formatters or point them at these configs.

---

## 4. Linting

| Language           | Tool                     | Config                                   |
| ------------------ | ------------------------ | ---------------------------------------- |
| TypeScript / React | **ESLint** (flat config) | `eslint.config.js`                       |
| Rust               | **Clippy**               | `clippy.toml` + `-D warnings` in scripts |

```bash
pnpm lint                # ESLint
pnpm lint:fix           # ESLint auto-fix
pnpm lint:rust           # Clippy (warnings as errors)
```

TypeScript `strict` mode is enabled in app `tsconfig` files. Prefer fixing root causes over disabling rules; use `_`-prefixed names for intentionally unused bindings.

---

## 5. Commit conventions

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(optional-scope): <summary>

[optional body]

[optional footer]
```

### Types

| Type       | When                                      |
| ---------- | ----------------------------------------- |
| `feat`     | New user-facing capability                |
| `fix`      | Bug fix                                   |
| `docs`     | Documentation only                        |
| `style`    | Formatting / whitespace (no logic change) |
| `refactor` | Code change without feat/fix              |
| `perf`     | Performance improvement                   |
| `test`     | Tests only                                |
| `build`    | Build system / dependencies               |
| `ci`       | CI configuration                          |
| `chore`    | Maintenance that doesn’t fit above        |

### Scopes (suggested)

`desktop`, `core`, `agents`, `tools`, `memory`, `database`, `shared`, `config`, `docs`, `scripts`

### Examples

```
feat(desktop): add Atlas shell greet IPC bridge
fix(memory): persist session id across restarts
docs: document code quality standards
chore(deps): bump @tauri-apps/cli
```

Rules enforced by **commitlint** (`commitlint.config.js`):

- Header ≤ 100 characters
- Body/footer separated by a blank line
- Body lines ≤ 100 characters (from `@commitlint/config-conventional`)

Cursor (Agent + Generate Commit Message) is steered by:

- `.cursor/rules/git-commits.mdc`
- `.cursorrules` (SCM sparkle button)

```bash
pnpm commitlint:last     # validate the latest commit message
```

---

## 6. Automatic checks

| Trigger              | What runs                                       |
| -------------------- | ----------------------------------------------- |
| `pnpm check:quality` | Prettier + ESLint + rustfmt check + Clippy      |
| `pnpm check`         | Quality checks + `cargo check` + frontend build |
| Pre-commit (Husky)   | lint-staged (Prettier + ESLint on staged files) |
| Commit-msg (Husky)   | commitlint                                      |

Install hooks after clone via `pnpm install` (runs `prepare` → Husky).

---

## 7. Pull request expectations

Before opening a PR:

1. `pnpm check:quality`
2. `pnpm build` (or `pnpm check`) when touching app code
3. Commits follow Conventional Commits
4. No secrets in `.env` or model weights committed

---

## Related documents

- `Development-Setup.md` — toolchain & commands
- `Version-Control.md` — branching strategy & Git workflow
- [`../product/MVP-Plan.md`](../product/MVP-Plan.md) — Phase 0 includes code standards
- [`../Architecture/17-Technology-Stack.md`](../Architecture/17-Technology-Stack.md) — Vitest / Playwright later
- [`../adr/`](../adr/) — architecture decisions
- [`../README.md`](../README.md) — documentation hub
