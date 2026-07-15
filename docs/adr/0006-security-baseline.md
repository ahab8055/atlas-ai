# ADR-0006: Security baseline package and rules

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Atlas AI project team

## Context

Atlas will access personal files and system resources. Phase 0 needs documented principles and a typed foundation so later tools cannot bypass policy. Security Architecture defines capability permissions, levels 0–3, OS keychain for secrets, and user authority over execution.

## Decision

1. Document the baseline in `docs/guides/Security.md`.
2. Ship `@atlas-ai/security` with:
   - capability + level model
   - `evaluatePermission` / approval request helpers
   - data sensitivity classification
   - `SecureStorageProvider` (keychain adapter contract; fail closed when unset)
3. Require future file/terminal/app tools to evaluate permissions before execution and to use approval when `requiresUserAction` is true.
4. Keep secrets out of JSON config; target OS keychain for MVP secret storage.

## Consequences

### Positive

- Clear rules for implementers and reviewers.
- Approval flow shape ready for Permission Center UI.
- Aligns with local-first, human-in-the-loop philosophy.

### Negative / trade-offs

- Enforcement is advisory until tools/agents are wired through this package.
- Keychain adapters not implemented yet.

### Follow-ups

- Desktop IPC + UI for approval prompts.
- Platform `SecureStorageProvider` implementations.
- Audit log schema for permission outcomes.
