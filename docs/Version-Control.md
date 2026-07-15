# Atlas AI — Version Control

How Atlas AI uses Git so changes stay reviewable and recoverable.

---

## Repository basics

| Item              | Value                                                                    |
| ----------------- | ------------------------------------------------------------------------ |
| Default branch    | `main`                                                                   |
| Hosting (planned) | GitHub                                                                   |
| Commit style      | [Conventional Commits](./Code-Quality-Standards.md#5-commit-conventions) |
| Hooks             | Husky (pre-commit lint-staged, commit-msg commitlint)                    |

Never commit secrets (`.env`), local data (`.data/`), or model weights under `models/` (directory is kept; files are ignored).

---

## Branching strategy

Atlas uses **GitHub Flow** for MVP: short-lived branches off `main`, merged back via pull request.

```
main
  ├── feature/<short-description>
  ├── fix/<short-description>
  ├── docs/<short-description>
  ├── chore/<short-description>
  └── refactor/<short-description>
```

### Branch roles

| Branch       | Purpose                                                          |
| ------------ | ---------------------------------------------------------------- |
| `main`       | Always shippable foundation. Protected once remote is connected. |
| `feature/*`  | New capabilities (desktop, packages, tooling)                    |
| `fix/*`      | Bug fixes                                                        |
| `docs/*`     | Documentation-only changes                                       |
| `chore/*`    | Dependencies, scripts, config maintenance                        |
| `refactor/*` | Internal restructuring without behavior change                   |

### Rules

1. Create branches from an up-to-date `main`.
2. Keep branches focused and short-lived.
3. Open a PR into `main` before merging.
4. Prefer **squash merge** so `main` history stays readable.
5. Delete the branch after merge.
6. Do not commit directly to `main` once a remote and branch protection exist (local bootstrapping excepted).

### Naming examples

```
feature/desktop-chat-shell
fix/tauri-dev-path
docs/version-control-guide
chore/eslint-flat-config
```

### Future (post-MVP)

If release trains or long-running integration are needed, introduce:

- `release/x.y` — cut from `main` for stabilization
- optional `develop` — only if multiple parallel workstreams require it

Do not add these until the workflow actually needs them.

---

## Day-to-day workflow

```bash
git checkout main
git pull

git checkout -b feature/my-change
# ... implement ...

pnpm check:quality
git add -p
git commit -m "feat(desktop): describe the change"
git push -u origin HEAD

# open PR → review → squash merge → delete branch
```

### Commit messages

Enforced by commitlint. Full guidelines: [Code-Quality-Standards.md § Commit conventions](./Code-Quality-Standards.md#5-commit-conventions).

Quick format:

```
<type>(optional-scope): <summary>
```

Examples: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `build`, `ci`, `perf`, `style`.

---

## What Git ignores

Configured in root [`.gitignore`](../.gitignore):

- Dependencies (`node_modules/`, `.pnpm-store/`)
- Secrets & local env (`.env`, not `.env.example`)
- Runtime data (`.data/`, SQLite files)
- Model weights (`models/**`, keeps `.gitkeep`)
- Build output (`dist/`, `target/`, caches)
- OS / editor junk

If you need a new ignore pattern, add it to the root `.gitignore` and document why in the PR.

---

## Hooks

After `pnpm install`:

| Hook         | Action                                          |
| ------------ | ----------------------------------------------- |
| `pre-commit` | lint-staged (Prettier + ESLint on staged files) |
| `commit-msg` | commitlint (Conventional Commits)               |

Bypass only with a strong reason (`--no-verify` is discouraged and not used in normal Atlas workflow).

---

## Related documents

- [Code-Quality-Standards.md](./Code-Quality-Standards.md) — commits, lint, format
- [Development-Setup.md](./Development-Setup.md) — local toolchain
- [MVP-Plan.md](./MVP-Plan.md) — Phase 0 foundation
