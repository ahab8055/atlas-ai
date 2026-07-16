# ADR-0030: Model router system

- **Status:** Accepted
- **Date:** 2026-07-16
- **Deciders:** Atlas AI project team

## Context

Architecture/25 requires automatic model selection: classify the task, analyze complexity, check hardware, and pick an appropriate model. Users must still override manually, and routing must be explainable.

## Decision

1. Add `analyzeTask`, `routeModel`, and `ModelRouter` in `@atlas-ai/ai` (`packages/ai/src/model-router/`).
2. Heuristic task analysis (type + complexity) maps to a preferred size class; rank registered models with `recommendModelsForProfile` + capability boosts.
3. `AiRuntime.route()` returns explainable decisions; optional `router` config auto-selects on `generate`/`stream` when `modelId` is omitted.
4. CLI: `atlas ai route "<prompt>"` (explain); `atlas ai ask` uses auto-routing; `load` / `--model` / config `defaultModelId` for manual selection.
5. Extend `recommendModelsForProfile` with optional `preferredSizeClass` for task-aware scoring.

## Consequences

### Positive

- Simple prompts can use smaller models; coding/reasoning tasks bias toward capable weights.
- Decisions include reasons and alternatives for transparency.
- Manual path unchanged via explicit model id.

### Negative / trade-offs

- Heuristic classification (not ML); may mislabel edge cases.
- Routing quality depends on registry metadata (capabilities, size, requirements).

### Follow-ups

- Integrate with intent detection; user preference profiles; disable auto-switch flag in config.
