# ADR-0017: Command line interface adapter

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Atlas AI project team

## Context

Phase 1 needs a way to exercise the core runtime before the desktop shell is complete. Architecture and ADR-0007 already treat CLI as the first input adapter (`source: "cli"`). The early `@atlas-ai/cli` was a single script; the user story requires interactive use, clear responses, and a debugging mode while keeping the CLI replaceable by voice/desktop.

## Decision

1. Keep `@atlas-ai/cli` as a thin adapter over `createRequestHandler` (never fork the pipeline).
2. Support one-shot commands and an interactive REPL (`-i`) with persistent `sessionId` / `ContextManager`.
3. Add `--debug` (and `ATLAS_CLI_DEBUG`): event-bus traces + verbose logs + result meta on stderr; user response on stdout.
4. Document the adapter boundary so desktop/voice swap `source` only.

## Consequences

### Positive

- Developers can test Atlas in the terminal end-to-end.
- Debug visibility into orchestration without changing core.
- Clear path to replace CLI with other adapters.

### Negative / trade-offs

- REPL is readline-based (no rich TUI).
- Debug output is text/JSON on stderr, not a structured debug UI.

### Follow-ups

- Optional pretty-print of plans/steps in debug.
- Wire desktop IPC adapter with the same handler pattern.
