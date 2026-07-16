# ADR-0038: AI provider abstraction layer

- **Status:** Accepted
- **Date:** 2026-07-16
- **Deciders:** Atlas AI project team

## Context

ADR-0022 introduced `InferenceProvider` with mock and llamacpp. Developers need a clear extension path for future engines (ONNX, cloud) without changing `AiRuntime` or `@atlas-ai/core`. Cloud support must remain optional and respect offline mode.

## Decision

1. Extend `InferenceProvider` with optional `ProviderDescriptor` (`kind`, `requiresNetwork`, `label`).
2. Tag local providers (`mock`, `llamacpp`) with `kind: "local"`.
3. Add `CloudStubInferenceProvider` and register it only when `cloudProviders=true` and `offlineMode=false`; no real cloud HTTP in this slice.
4. Centralize registration in `registerBuiltinProviders` used by `createAiRuntime`.
5. Expose `atlas ai providers` for visibility; document the plug-in pattern in AI-Providers.md.

## Consequences

### Positive

- New providers implement the port and register — zero core runtime changes.
- Cloud remains prepared but gated; offline-first defaults unchanged.

### Negative / trade-offs

- Cloud stub is not a usable backend (intentionally); real clients are follow-up.

### Follow-ups

- OpenAI/Anthropic providers; ONNX; optional provider selection UI.
