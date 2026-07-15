# ADR-0005: GitHub Actions CI for pull requests

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Atlas AI project team

## Context

Phase 0 requires automated checks so quality is maintained during development. Technology Stack recommends GitHub Actions with a pipeline of tests and build.

## Decision

1. Add `.github/workflows/ci.yml` triggered on pull requests and pushes to `main`.
2. Run three required jobs: **Lint & format**, **Test**, and **Build**.
3. Document branch protection so these checks can block merges once the repo is on GitHub.
4. Defer packaging/release and Playwright e2e to later workflows.

## Consequences

### Positive

- Build and test failures surface automatically on PRs.
- Local commands stay the source of truth (`pnpm` / `cargo`).

### Negative / trade-offs

- Ubuntu Tauri system packages add install time on Rust-related jobs.
- Merge blocking depends on enabling GitHub branch protection (manual one-time setup).

### Follow-ups

- [guides/CI-CD.md](../guides/CI-CD.md)
- Add rust-cache / e2e / release workflows when needed.
