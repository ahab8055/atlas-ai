# Atlas AI — Inference Configuration

Configurable inference settings for local models (Architecture/09 Inference Engine).

Related: [Local-AI-Runtime.md](./Local-AI-Runtime.md), [LlamaCpp-Integration.md](./LlamaCpp-Integration.md), [Configuration.md](./Configuration.md), [ADR-0031](../adr/0031-inference-configuration.md), [`@atlas-ai/ai`](../../packages/ai/).

---

## Purpose

- Configure **temperature**, **token limits**, **context length**, and **streaming**.
- Persist settings **safely** (validated JSON under `dataDir`, no secrets).
- Allow **different models** to use different overrides.

---

## Layers (later wins)

1. Built-in defaults
2. Atlas config (`ai.inference` + `ai.hardware.contextSize`) / env
3. Persisted global overrides (`.data/inference-settings.json`)
4. Persisted per-model overrides
5. Per-request `GenerateRequest` fields

---

## CLI

```bash
pnpm atlas ai inference
pnpm atlas ai inference get coding/coder

pnpm atlas ai inference set temperature=0.3 maxTokens=512 contextLength=8192 stream=true
pnpm atlas ai inference set --model coding/coder temperature=0.1 maxTokens=2048

pnpm atlas ai inference reset --model coding/coder
pnpm atlas ai inference reset global
```

---

## Config / env

```json
"ai": {
  "inference": {
    "temperature": 0.7,
    "maxTokens": 256,
    "topP": 0.9,
    "topK": 40,
    "repeatPenalty": 1.1,
    "stream": true
  },
  "hardware": {
    "contextSize": 4096
  }
}
```

| Env                     | Field                       |
| ----------------------- | --------------------------- |
| `ATLAS_AI_TEMPERATURE`  | temperature                 |
| `ATLAS_AI_MAX_TOKENS`   | maxTokens                   |
| `ATLAS_AI_CONTEXT_SIZE` | contextSize / contextLength |
| `ATLAS_AI_STREAM`       | `true` / `false`            |

---

## API

```ts
import {
  createInferenceConfigManager,
  formatInferenceConfig,
} from "@atlas-ai/ai";

const manager = createInferenceConfigManager({
  dataDir: ".data",
  base: {
    temperature: 0.7,
    maxTokens: 256,
    topP: 0.9,
    topK: 40,
    repeatPenalty: 1.1,
    contextLength: 4096,
    stream: true,
  },
});

manager.setForModel("coding/coder", { temperature: 0.2, maxTokens: 2048 });
console.log(formatInferenceConfig(manager.resolve("coding/coder")));
```

`AiRuntime` applies resolved sampling params on `generate` / `stream`, and sets provider context length on load. `atlas ai ask` streams when `stream: true`.

---

## Safe storage

- File: `{dataDir}/inference-settings.json` (mode `0600`, atomic write)
- Numeric values clamped to safe bounds
- Secret-like keys (`apiKey`, `token`, …) are rejected

---

## Out of scope

Cloud provider credentials, live VRAM budgeting, per-session ephemeral UI preferences beyond request overrides.
