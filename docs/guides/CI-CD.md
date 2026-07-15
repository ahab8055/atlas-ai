# Atlas AI — CI/CD

Automated quality gates via **GitHub Actions** (Technology Stack recommendation).

Related: [Testing.md](./Testing.md), [Code-Quality-Standards.md](./Code-Quality-Standards.md), [Version-Control.md](./Version-Control.md).

---

## Workflow

File: [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)

**Triggers**

- Every **pull request**
- Pushes to **`main`**

**Jobs** (all must pass)

| Job               | Checks                                                                      |
| ----------------- | --------------------------------------------------------------------------- |
| **Lint & format** | Prettier, ESLint, rustfmt, Clippy                                           |
| **Test**          | Build workspace packages, Vitest (unit + Phase 1 integration), `cargo test` |
| **Build**         | `pnpm build` (packages + desktop frontend), `cargo check`                   |

Failures on any job fail the workflow, so PR merges can be blocked when branch protection is enabled.

---

## Required status checks (block merging)

In GitHub → **Settings → Branches → Branch protection** for `main`:

1. Enable **Require a pull request before merging**
2. Enable **Require status checks to pass before merging**
3. Require these checks (names must match the workflow job `name:`):
   - `Lint & format`
   - `Test`
   - `Build`
4. Optionally: **Require branches to be up to date before merging**

Until a remote exists and protection is turned on, CI still runs on PRs once the repo is on GitHub, but merges are not forcibly blocked.

---

## Local parity

Run the same gates before opening a PR:

```bash
pnpm format:check
pnpm lint
pnpm format:rust:check
pnpm lint:rust
pnpm test:all
pnpm build
pnpm check:rust
```

Or approximately: `pnpm check && pnpm test:all`

---

## Caching

- Node: pnpm store via `actions/setup-node` cache
- Rust: relies on `dtolnay/rust-toolchain` + default cargo behavior; extend with `Swatinem/rust-cache` later if needed

---

## Future pipeline stages

Aligned with Architecture/17 development pipeline:

```
Code push → Tests → Build → Package → Release
```

Not in this foundation workflow yet:

- Full `pnpm build:desktop` / signed Tauri artifacts
- Playwright e2e (`tests/e2e/`)
- Release publishing

Add those as separate workflows when packaging is ready.
