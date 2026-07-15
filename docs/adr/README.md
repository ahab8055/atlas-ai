# Architecture Decision Records (ADRs)

ADRs capture significant, durable decisions so Atlas AI stays consistent as the system grows.

## When to write an ADR

Create an ADR when you:

- Choose or change a major technology (runtime, DB, packaging).
- Change package / process boundaries (e.g. in-process package vs sidecar).
- Adopt a cross-cutting convention that others must follow.
- Accept a meaningful trade-off (security, privacy, performance, scope).

Skip ADRs for trivial or easily reversible changes (typos, small refactors, dependency patch bumps).

## Process

1. Copy [`template.md`](./template.md) to `NNNN-short-kebab-title.md` (next free number).
2. Fill **Status**, **Context**, **Decision**, **Consequences**.
3. Open a PR (`docs/...` branch) and link related Architecture / product docs.
4. After merge, set status to **Accepted** (or **Deprecated** / **Superseded by ADR-XXXX** later).

## Index

| ADR                                             | Title                                   | Status   |
| ----------------------------------------------- | --------------------------------------- | -------- |
| [0001](./0001-record-architecture-decisions.md) | Record architecture decisions as ADRs   | Accepted |
| [0002](./0002-documentation-structure.md)       | Adopt organized documentation structure | Accepted |
| [0003](./0003-configuration-management.md)      | Configuration management approach       | Accepted |
| [0004](./0004-structured-logging.md)            | Structured local logging                | Accepted |
| [0005](./0005-github-actions-ci.md)             | GitHub Actions CI for pull requests     | Accepted |
| [0006](./0006-security-baseline.md)             | Security baseline package and rules     | Accepted |
| [0007](./0007-request-processing-pipeline.md)   | Request processing pipeline in core     | Accepted |
| [0008](./0008-intent-detection-registry.md)     | Intent detection registry               | Accepted |

## Naming

```
NNNN-short-kebab-title.md
```

Examples: `0003-use-pnpm-workspaces.md`, `0004-sqlite-as-primary-store.md`

## Related

- [Documentation hub](../README.md)
- [Architecture index](../Architecture/README.md)
- [guides/Code-Quality-Standards.md](../guides/Code-Quality-Standards.md)
