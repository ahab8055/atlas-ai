# Atlas AI — llama.cpp Integration

Primary local inference engine: **llama.cpp** + **GGUF** (Architecture/09, /17).

Related: [Local-AI-Runtime.md](./Local-AI-Runtime.md), [ADR-0023](../adr/0023-llamacpp-integration.md), [`@atlas-ai/ai`](../../packages/ai/), [`models/`](../../models/).

---

## What this provides

- Validate and load **GGUF** weights from `models/`
- Configurable **inference** parameters (temperature, maxTokens, topP, topK, repeatPenalty)
- **CPU-first** execution (`-ngl 0`); GPU layers reserved for later (`acceleration: gpu`)
- Still uses the `InferenceProvider` abstraction (`LlamaCppProvider`)

---

## Config

```json
"ai": {
  "provider": "llamacpp",
  "endpoint": "http://127.0.0.1:8080",
  "defaultModelId": "your-model",
  "inference": {
    "temperature": 0.7,
    "maxTokens": 256,
    "topP": 0.9,
    "topK": 40,
    "repeatPenalty": 1.1
  },
  "hardware": {
    "acceleration": "cpu",
    "threads": 0,
    "gpuLayers": 0,
    "contextSize": 4096
  },
  "llamaCpp": {
    "manageServer": false,
    "binary": "llama-server"
  }
}
```

| Mode                  | Behavior                                                                           |
| --------------------- | ---------------------------------------------------------------------------------- |
| `manageServer: false` | Expect an already-running `llama-server`; `load` validates GGUF then selects model |
| `manageServer: true`  | Atlas spawns `llama-server -m … -ngl 0` (CPU) on `load`                            |

GPU prep: set `"acceleration": "gpu"` and `"gpuLayers": N` (e.g. 32). CPU mode always forces `ngl=0`.

Detect a suggested profile with `pnpm atlas ai hardware` (see [Hardware-Detection.md](./Hardware-Detection.md)); config is not overwritten automatically.

---

## CLI

```bash
# Place a GGUF under models/, start server (or enable manageServer)
llama-server -m ./models/your-model.gguf --port 8080 -ngl 0

ATLAS_AI_PROVIDER=llamacpp ATLAS_AI_DEFAULT_MODEL=your-model pnpm atlas ai status
pnpm atlas ai models
pnpm atlas ai load your-model
pnpm atlas ai ask "Summarize Atlas AI"
```

Mock (no weights) still works: `pnpm atlas ai ask "hello"`.

---

## Programmatic

```ts
import { createAiRuntime } from "@atlas-ai/ai";

const ai = createAiRuntime({
  provider: "llamacpp",
  modelsDir: "models",
  defaultModelId: "your-model",
  hardware: { acceleration: "cpu", gpuLayers: 0 },
  inference: { temperature: 0.3, maxTokens: 128 },
});

await ai.loadModel();
const out = await ai.generate({
  messages: [{ role: "user", content: "Hello" }],
});
```
