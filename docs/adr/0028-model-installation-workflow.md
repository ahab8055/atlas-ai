# ADR-0028: Model installation workflow

- **Status:** Accepted
- **Date:** 2026-07-16
- **Deciders:** Atlas AI project team

## Context

Architecture/25 defines a Model Installation System: compatibility check → storage check → download → validate → register. Storage (ADR-0025), registry (ADR-0024), and hardware profiles (ADR-0027) already exist; users still lacked a single workflow to place a GGUF into `models/` and have it appear in the catalog.

## Decision

1. Add `ModelInstaller` in `@atlas-ai/ai` orchestrating the Architecture/25 steps.
2. Support **local file** and **http(s) URL** GGUF sources; validate magic before register.
3. Run **compatibility** checks against detected hardware (warnings by default; storage shortage is an error).
4. Place weights under `models/<category>/` and **auto-register** via `ModelRegistry`.
5. CLI: `atlas ai install <source> [category]` and `--dry-run` / `--check`.

## Consequences

### Positive

- Users can install supported models with clear compatibility warnings.
- Installed models appear in the persistent registry when the CLI DB is enabled.
- Reuses storage layout, GGUF validation, and hardware detection.

### Negative / trade-offs

- No marketplace index — callers supply a path/URL.
- Large downloads stream to temp then move; resume is not implemented.

### Follow-ups

- Optional checksum / `model.json` metadata.
- Progress events for desktop UI.
