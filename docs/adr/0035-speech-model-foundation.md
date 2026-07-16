# ADR-0035: Speech model preparation foundation

- **Status:** Accepted
- **Date:** 2026-07-16
- **Deciders:** Atlas AI project team

## Context

Architecture/25 includes Speech Model Management. Architecture/08 Voice needs STT/TTS backends later. Chat uses `InferenceProvider`; embeddings already showed a separate provider port pattern (ADR-0034). Response generation already exposes `spokenText` for future TTS. We need storage, metadata, and ports now without shipping Whisper/Piper or audio device I/O.

## Decision

1. Keep top-level category `speech`; nest modality dirs `models/speech/stt` and `models/speech/tts`.
2. Add `SpeechModelManager` + speech discover/scan in `@atlas-ai/ai` (`packages/ai/src/speech/`), registering into the shared model registry with capabilities `speech` + `stt`/`tts`.
3. Define `SpeechToTextProvider` / `TextToSpeechProvider` ports (transcribe / synthesize + health/list/load/unload) and ship offline mocks only.
4. Allow non-GGUF speech weights (`.onnx`, `.ggml`, `.bin`) under speech dirs with format tagging; GGUF magic-validate when applicable.
5. CLI: `atlas ai speech` (storage / models / register / status) and `install … speech --modality stt|tts`.

## Consequences

### Positive

- Voice can plug real STT/TTS backends into stable ports without restructuring Local AI Engine.
- Speech catalog reuses registry lifecycle (list/register/remove) like language models.
- Clear boundary from chat inference (same pattern as embeddings).

### Negative / trade-offs

- Root GGUF scanner does not recurse into `stt`/`tts` — speech sync uses dedicated scan (`SpeechModelManager.syncFromDisk`).
- Mocks are plumbing only; no real transcription or synthesis yet.

### Follow-ups

- Wire Architecture/08 voice pipeline (mic/VAD), Whisper/Piper (or equivalent) providers, and TTS from `spokenText`.
