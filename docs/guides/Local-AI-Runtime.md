# Atlas AI — Local AI Runtime

Foundation for running AI models locally without internet (Architecture/09, /17, /25).

Related: [Architecture/09](../Architecture/09-Local-AI-Architecture.md), [Architecture/25](../Architecture/25-Model-Management-System.md), [Model-Registry.md](./Model-Registry.md), [Model-Storage.md](./Model-Storage.md), [Model-Installation.md](./Model-Installation.md), [Model-Compatibility.md](./Model-Compatibility.md), [Hardware-Detection.md](./Hardware-Detection.md), [Hardware-Profiles.md](./Hardware-Profiles.md), [Embedding-Models.md](./Embedding-Models.md), [Speech-Models.md](./Speech-Models.md), [Runtime-Monitoring.md](./Runtime-Monitoring.md), [Offline-Mode.md](./Offline-Mode.md), [AI-Providers.md](./AI-Providers.md), [LlamaCpp-Integration.md](./LlamaCpp-Integration.md), [ADR-0022](../adr/0022-ai-runtime-foundation.md), [ADR-0023](../adr/0023-llamacpp-integration.md), [ADR-0024](../adr/0024-model-registry.md), [ADR-0025](../adr/0025-model-storage-manager.md), [ADR-0026](../adr/0026-hardware-detection.md), [ADR-0027](../adr/0027-hardware-profile-management.md), [ADR-0028](../adr/0028-model-installation-workflow.md), [ADR-0029](../adr/0029-model-compatibility-checker.md), [`@atlas-ai/ai`](../../packages/ai/), [`models/`](../../models/).

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

Download/marketplace, native node-llama-cpp bindings, cloud providers, LLM-backed intent/planning, speech managers.
