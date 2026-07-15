# `@atlas-ai/ai`

Local AI runtime foundation — load and run models **outside** `@atlas-ai/core`.

## Providers

| Id         | Role                                                           |
| ---------- | -------------------------------------------------------------- |
| `mock`     | Deterministic offline replies (CI / default)                   |
| `llamacpp` | HTTP client to local `llama-server` (GGUF / OpenAI-compatible) |

## Usage

```ts
import { createAiRuntime } from "@atlas-ai/ai";

const ai = createAiRuntime({
  provider: "mock",
  defaultModelId: "mock-general",
});
await ai.loadModel();
const result = await ai.generate({
  messages: [{ role: "user", content: "hello" }],
});
console.log(result.text);
```

See [docs/guides/Local-AI-Runtime.md](../../docs/guides/Local-AI-Runtime.md).
