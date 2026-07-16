# ADR-0027: Hardware profile management

- **Status:** Accepted
- **Date:** 2026-07-16
- **Deciders:** Atlas AI project team

## Context

ADR-0026 added host detection and a coarse tier (`low` / `standard` / `high`). The product story asks for an explicit hardware profile system with resource categories, **low / balanced / performance** profiles, and mapping those profiles to **model recommendations**.

## Decision

1. Introduce canonical `ResourceProfileId`: `low` | `balanced` | `performance` (Architecture/25 Low Resource / Standard / High Performance).
2. Define `RESOURCE_PROFILES` with resource categories (cpu, memory, gpu, acceleration) and model guidance (size class, maxMinRam, preferred capabilities).
3. Classification via `classifyResourceProfile` (legacy `standard`→`balanced`, `high`→`performance`).
4. `recommendModelsForProfile` ranks registry models for the active profile (+ optional host suitability).
5. CLI: `atlas ai profiles`, `atlas ai recommend`; `atlas ai hardware` shows profile + recommendations.

## Consequences

### Positive

- Device capability is a named, documented profile.
- Recommended models can be generated from the local catalog.
- Detection and recommendation stay in `@atlas-ai/ai` for the Model Router to consume later.

### Negative / trade-offs

- Recommendations need registered models (`atlas ai register`); empty catalogs yield empty lists.
- Size-class heuristics use file size when metadata is sparse.

### Follow-ups

- Model Router using profile + task type.
- Optional apply-suggested-inference to config.
