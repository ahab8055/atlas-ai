# ADR-0033: GGUF quantization support

- **Status:** Accepted
- **Date:** 2026-07-16
- **Deciders:** Atlas AI project team

## Context

Architecture/25 Model Quantization Management requires support for quantized formats (FP16, Q8–Q4, etc.), detection of quantization level, hardware-aware recommendations, and documented tradeoffs so Atlas runs efficiently on consumer hardware.

## Decision

1. Add `packages/ai/src/quantization/` with `detectQuantization`, `recommendQuantization`, tradeoff tables, and scoring helpers.
2. Detect levels primarily from GGUF filenames / model ids (llama.cpp tags: `Q4_K_M`, `IQ4_NL`, `F16`, …).
3. On registry discover/install, attach `quantized` capability + `requirements.quantization`.
4. Factor quantization fit into `recommendModelsForProfile` scoring.
5. CLI: `atlas ai quantization` (recommend / detect / tradeoffs). Document tradeoffs in `docs/guides/Quantization.md`.

## Consequences

### Positive

- Users can identify which quant they have and pick levels that fit RAM/GPU.
- Recommendations prefer consumer-friendly Q4/Q5 over F16 on low hosts.
- Quantized GGUFs continue to run via existing llama.cpp path.

### Negative / trade-offs

- Filename-based detection misses oddly named files without Q*/F* tags.
- Soft scoring cannot replace measuring actual peak RAM.

### Follow-ups

- Optional GGUF metadata `general.file_type` parse; suggest download of alternate quants in install UX.
