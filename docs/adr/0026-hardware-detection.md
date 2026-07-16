# ADR-0026: Hardware detection system

- **Status:** Accepted
- **Date:** 2026-07-16
- **Deciders:** Atlas AI project team

## Context

Architecture/25 requires a Hardware Detection System that collects CPU, RAM, GPU, VRAM, and OS information, builds resource profiles (Low / Standard / High), and feeds model selection. ADR-0023 left auto GPU detection as a follow-up; config still defaults to CPU (`gpuLayers: 0`).

## Decision

1. Add `detectHardware()` in `@atlas-ai/ai` using Node `os` plus best-effort platform GPU probes (no native deps).
2. Emit `DetectedHardware` including Architecture/25 `tier` and a suggested `HardwareProfile` for llama.cpp.
3. Provide `evaluateModelSuitability` / `selectSuitableModels` for model selection logic against registry requirements.
4. Keep probes injectable via `SystemProbe` for offline tests; CLI: `atlas ai hardware`.
5. Do not auto-overwrite user config — suggestion only until Model Router / setup wizard consume it.

## Consequences

### Positive

- Atlas can describe the host and classify resource tiers.
- Model listing can annotate fit against detected hardware.
- Suggested `gpuLayers` unblocks GPU path without forcing it.

### Negative / trade-offs

- VRAM accuracy depends on OS tools (`nvidia-smi`, `system_profiler`, `wmic`).
- Apple Silicon often lacks discrete VRAM numbers (unified memory).

### Follow-ups

- Model Router using tier + task type.
- Optional “apply suggested hardware to config” UX.
