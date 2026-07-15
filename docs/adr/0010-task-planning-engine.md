# ADR-0010: Task planning engine

- **Status:** Accepted
- **Date:** 2026-07-15
- **Deciders:** Atlas AI project team

## Context

Phase 1 needs Atlas to create execution plans for simple and multi-step tasks so the tool system can run ordered actions. Architecture/22 defines Simple Planning and Multi-Step Planning. The story example “Prepare my development environment” requires open editor → open project → start backend → start frontend.

## Decision

1. Add a planning module in `@atlas-ai/core` with `ExecutionPlan` / `PlanStep` (`order`, `tool`, `args`, `capability`).
2. Use a `PlanRegistry` of templates keyed by intent name (extensible like intents).
3. Classify plans as `simple` or `multi` from step count.
4. Ship a multi-step `environment.setup` template for the development-environment story.
5. Execute steps in order; skip remaining required steps after a block/failure so plans remain tool-system friendly.

## Consequences

### Positive

- Consistent plan structure for current stubs and future `@atlas-ai/tools`.
- Single- and multi-step coverage with clear ordering.
- New workflows via `registerPlanTemplate` without pipeline changes.

### Negative / trade-offs

- Templates are heuristic (intent → fixed steps) until an LLM/agent planner exists.
- Env-setup tools are stubs and typically blocked by security until permissions are granted.

### Follow-ups

- Agent/LLM planner behind the same `ExecutionPlan` contract.
- Wire real tool registry implementations.
- Parallel/optional step groups when workflows need them.
