# Atlas AI — Local AI Runtime

Foundation for running AI models locally without internet (Architecture/09, /17, /25).

Related: [Architecture/09](../Architecture/09-Local-AI-Architecture.md), [Architecture/25](../Architecture/25-Model-Management-System.md), [ADR-0022](../adr/0022-ai-runtime-foundation.md), [`@atlas-ai/ai`](../../packages/ai/), [`models/`](../../models/).

---

## Purpose

- Communicate with a **local AI runtime** (llama.cpp `llama-server`).
- Keep **model execution outside** `@atlas-ai/core`.
- Support **multiple backends** later via a provider registry.

---

## Package

`@atlas-ai/ai` owns:

| Piece                       | Role                                                  |
| --------------------------- | ----------------------------------------------------- |
| `InferenceProvider`         | Port: health, load/unload, generate, stream           |
| `InferenceProviderRegistry` | Register `mock`, `llamacpp`, future ONNX/cloud        |
| `AiRuntime`                 | Facade used by CLI / (later) core                     |
| `MockInferenceProvider`     | Offline CI default                                    |
| `LlamaCppProvider`          | HTTP client to local llama-server (OpenAI-compatible) |

Core orchestration never imports llama.cpp.

---

## Config

In `config/*.json`:

```json
"ai": {
  "provider": "mock",
  "endpoint": "http://127.0.0.1:8080",
  "defaultModelId": "mock-general"
}
```

Env overrides: `ATLAS_AI_PROVIDER`, `ATLAS_AI_ENDPOINT`, `ATLAS_AI_DEFAULT_MODEL`, `ATLAS_MODELS_DIR`.

---

## Usage

```ts
import { createAiRuntime } from "@atlas-ai/ai";

const ai = createAiRuntime({
  provider: "mock",
  defaultModelId: "mock-general",
});
await ai.loadModel();
const out = await ai.generate({
  messages: [{ role: "user", content: "hello" }],
});
```

CLI probe:

```bash
pnpm atlas ai status
```

With a real server:

```bash
llama-server -m ./models/your-model.gguf --port 8080
ATLAS_AI_PROVIDER=llamacpp pnpm atlas ai status
```

---

## Out of scope (this foundation)

Download/marketplace, native node-llama-cpp bindings, cloud providers, LLM-backed intent/planning, embeddings/speech managers.
