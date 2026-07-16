# ADR-0031: Inference configuration system

- **Status:** Accepted
- **Date:** 2026-07-16
- **Deciders:** Atlas AI project team

## Context

Architecture/09 requires configurable inference (temperature, context, token generation, streaming). ADR-0023 placed sampling defaults in global config + `GenerateRequest`, but developers still need a dedicated module for validated persistence and **per-model** overrides without storing secrets.

## Decision

1. Add `InferenceConfigManager` in `@atlas-ai/ai` (`packages/ai/src/inference-config/`) covering temperature, maxTokens, contextLength, stream, plus existing topP/topK/repeatPenalty.
2. Resolve settings in layers: defaults → Atlas config → persisted global → per-model → request.
3. Persist overrides in `{dataDir}/inference-settings.json` with validation, range clamping, forbidden secret keys, and atomic writes (`0600`).
4. Wire `AiRuntime` to apply resolved params on generate/stream and context length on load; CLI `atlas ai inference` for show/set/reset; `ask` streams when `stream` is true.
5. Extend `AtlasAiInferenceConfig` with `stream`; env overrides for temperature, maxTokens, contextSize, stream.

## Consequences

### Positive

- Inference can be tuned per model for quality vs latency.
- Settings are explainable (source attribution) and safely stored.
- Streaming preference is first-class for CLI / runtime callers.

### Negative / trade-offs

- Context length on managed llama-server still requires reload to take effect.
- Heuristic clamp bounds may need tuning as larger models arrive.

### Follow-ups

- Surface inference config in desktop settings UI; optional schema migration if store version evolves.
