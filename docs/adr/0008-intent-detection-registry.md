# ADR-0008: Intent detection registry

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Atlas AI project team

## Context

Phase 1 needs Atlas to classify commands into goals with a consistent structure (category, parameters, confidence) and to handle unknown input gracefully. New intents will be added often; hard-coding a growing `if` chain in the pipeline stage does not scale. Architecture Component Intent Processor shows intent + parameters as the contract.

## Decision

1. Implement intent detection in `@atlas-ai/core` as a **registry of `IntentDefinition` matchers**.
2. Always return a `DetectedIntent` object (`name`, `category`, `goal`, `parameters`, `confidence`, `capabilities`, `complexity`, `known`).
3. Map unmatched input to `unknown` (`known: false`) instead of failing the pipeline.
4. Ship MVP builtins for system help/status/echo, application open, file search, and code analysis; allow `registerIntent` / custom registries later.
5. Keep matchers heuristic until a model-backed Request Analyzer replaces matching while preserving the same output shape.

## Consequences

### Positive

- Consistent structure for planners and tools.
- New intents without changing pipeline orchestration.
- Story examples (Open VS Code, Find project files, Explain code) are covered.

### Negative / trade-offs

- Regex/heuristic matching will misclassify ambiguous phrasing until LLM intent lands.
- Global `registerIntent` mutates process state (tests should prefer isolated registries when needed).

### Follow-ups

- Model-backed analyzer behind the same `DetectedIntent` contract.
- Richer slot filling (paths, URIs, multi-entity).
