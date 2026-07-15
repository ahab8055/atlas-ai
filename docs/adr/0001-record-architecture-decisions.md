# ADR-0001: Record architecture decisions as ADRs

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Atlas AI project team

## Context

Atlas AI has a large Architecture and PRD set. Without a lightweight decision log, stack and boundary choices risk being rediscovered, contradicted, or lost in chat history.

## Decision

Use Architecture Decision Records under `docs/adr/`:

- One Markdown file per significant decision.
- Numbered `NNNN-kebab-title.md`.
- Follow [`template.md`](./template.md) (Context → Decision → Consequences).
- Index every ADR in [`README.md`](./README.md).

## Consequences

### Positive

- Decisions are reviewable in PRs and searchable in-repo.
- New contributors can see _why_ the stack and structure exist.

### Negative / trade-offs

- Small process overhead when making structural changes.

### Follow-ups

- Keep the ADR index updated when adding or superseding records.
