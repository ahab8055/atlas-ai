# ADR-0002: Adopt organized documentation structure

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Atlas AI project team

## Context

Phase 0 foundation needed a durable place for product plans, architecture, developer guides, and decisions. Docs had grown as a flat mix of top-level files plus `Architecture/` and `PRD/`.

## Decision

Organize `docs/` as:

| Folder          | Contents                                         |
| --------------- | ------------------------------------------------ |
| `product/`      | MVP plan, technology stack overview              |
| `PRD/`          | Numbered product requirements (unchanged)        |
| `Architecture/` | Numbered architecture docs 01–25 (unchanged)     |
| `guides/`       | Development setup, code quality, version control |
| `adr/`          | Architecture Decision Records                    |
| `README.md`     | Hub + conventions for future docs                |

Future documents must land in the matching folder and be indexed in that folder’s README.

## Consequences

### Positive

- Clear ownership of doc types; fewer “where does this go?” debates.
- Architecture and PRD numbering schemes preserved.

### Negative / trade-offs

- Existing links to moved guides/product files needed updates.

### Follow-ups

- Prefer ADRs for further structural doc changes.
- Keep [docs/README.md](../README.md) as the navigation entry point.
