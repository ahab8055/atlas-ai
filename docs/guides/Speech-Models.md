# Atlas AI — Speech Model Preparation

Speech weight storage, registry management, and STT/TTS provider ports so Architecture/08 Voice can integrate later without restructuring Local AI Engine.

Related: [Architecture/08](../Architecture/08-Voice-System-Architecture.md), [Architecture/25](../Architecture/25-Model-Management-System.md), [Model-Storage.md](./Model-Storage.md), [Model-Registry.md](./Model-Registry.md), [Embedding-Models.md](./Embedding-Models.md) (same independence pattern), [Response-Generation.md](./Response-Generation.md) (`spokenText`), [ADR-0035](../adr/0035-speech-model-foundation.md), [`@atlas-ai/ai`](../../packages/ai/).

---

## Purpose

- Keep speech weights under **`models/speech/{stt,tts}/`**.
- Manage speech models via **`SpeechModelManager`** (list / register / remove) on the shared model registry.
- Expose stable **`SpeechToTextProvider`** / **`TextToSpeechProvider`** ports with offline mocks.
- Prepare TTS to consume response **`spokenText`** later (no mic/VAD/wake-word in this foundation).

---

## Independence from chat

| Concern        | Chat                       | Speech                                          |
| -------------- | -------------------------- | ----------------------------------------------- |
| Provider port  | `InferenceProvider`        | `SpeechToTextProvider` / `TextToSpeechProvider` |
| Mock (CI)      | `mock`                     | `mock-stt` / `mock-tts`                         |
| Weights folder | `models/general`, `coding` | `models/speech/stt`, `models/speech/tts`        |
| Formats        | GGUF (primary)             | GGUF, ONNX, ggml, bin                           |

---

## Layout

```
models/
└── speech/
    ├── stt/          # speech-to-text weights
    └── tts/          # text-to-speech weights
```

Non-GGUF files under these dirs are size-validated only; GGUF gets magic validation.

---

## CLI

```bash
pnpm atlas ai speech                 # overview + layout status
pnpm atlas ai speech storage         # ensure speech/stt + speech/tts
pnpm atlas ai speech models [stt|tts]
pnpm atlas ai speech register        # scan speech dirs → registry
pnpm atlas ai speech status          # mock STT/TTS health

# Install GGUF into nested speech dirs (default modality: stt)
pnpm atlas ai install ./whisper.gguf speech --modality stt
pnpm atlas ai install ./piper.gguf speech --modality tts
```

---

## API

```ts
import {
  createSpeechModelManager,
  createModelRegistry,
  MockSpeechToTextProvider,
  MockTextToSpeechProvider,
} from "@atlas-ai/ai";

const registry = createModelRegistry({ modelsDir: "./models" });
const speech = createSpeechModelManager({
  modelsDir: "./models",
  registry,
});

speech.ensureStructure();
speech.syncFromDisk();
const sttModels = speech.list({ modality: "stt" });

const stt = new MockSpeechToTextProvider();
const transcript = await stt.transcribe({
  data: new Uint8Array(),
  mimeType: "audio/wav",
});

const tts = new MockTextToSpeechProvider();
const audio = await tts.synthesize({ text: spokenTextFromResponse });
```

---

## Out of scope

Microphone capture, VAD, wake-word, real Whisper/Piper inference, audio device I/O, desktop voice UI.

---

## Related ADRs

- [ADR-0035](../adr/0035-speech-model-foundation.md) — this foundation
- [ADR-0025](../adr/0025-model-storage-manager.md) — category layout
- [ADR-0034](../adr/0034-embedding-model-integration.md) — parallel provider-port pattern
