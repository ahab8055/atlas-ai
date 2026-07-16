# Atlas AI — AI Providers

Pluggable inference backends behind a common port so Atlas can add engines without changing core orchestration.

Related: [Local-AI-Runtime.md](./Local-AI-Runtime.md), [Offline-Mode.md](./Offline-Mode.md), [ADR-0022](../adr/0022-ai-runtime-foundation.md), [ADR-0038](../adr/0038-ai-provider-abstraction.md), [`@atlas-ai/ai`](../../packages/ai/).

---

## Purpose

- One **`InferenceProvider`** interface for all engines.
- **Local** providers today (`mock`, `llamacpp`).
- **Optional cloud** preparation (`cloud-stub`) gated by feature flags — no real cloud HTTP yet.
- **Core/CLI** talk only to `AiRuntime` / the port — never llama.cpp internals.

---

## Interface

```ts
interface InferenceProvider {
  readonly id: string;
  readonly meta?: ProviderDescriptor; // kind, requiresNetwork, label
  health(): Promise<RuntimeHealth>;
  listModels(): Promise<ModelInfo[]>;
  load(modelId: string): Promise<ModelInfo>;
  unload(): Promise<void>;
  generate(req: GenerateRequest): Promise<GenerateResult>;
  stream(req: GenerateRequest): AsyncIterable<StreamChunk>;
}
```

---

## Built-ins

| Id           | Kind  | Network       | Role                                                               |
| ------------ | ----- | ------------- | ------------------------------------------------------------------ |
| `mock`       | local | no            | Offline CI default                                                 |
| `llamacpp`   | local | no (loopback) | Local GGUF via llama-server                                        |
| `cloud-stub` | cloud | yes           | Registered only when `cloudProviders=true` and `offlineMode=false` |

Register via `registerBuiltinProviders(registry, options)` (used by `createAiRuntime`).

---

## Add a provider (no AiRuntime edits)

```ts
import {
  InferenceProviderRegistry,
  createAiRuntime,
  type InferenceProvider,
} from "@atlas-ai/ai";

const custom: InferenceProvider = {
  id: "my-engine",
  meta: { kind: "local", requiresNetwork: false, label: "My engine" },
  // … implement health/listModels/load/unload/generate/stream
};

const registry = new InferenceProviderRegistry();
registry.register(custom);
const ai = createAiRuntime({
  registry,
  providers: [custom],
  provider: "my-engine",
});
```

---

## CLI

```bash
pnpm atlas ai providers   # id, kind, local/network, health
pnpm atlas ai status
```

---

## Cloud preparation

- `features.cloudProviders` + `!features.offlineMode` → register `cloud-stub`.
- Stub refuses real work with `cloud_not_configured` / offline policy codes.
- Future: implement OpenAI/Anthropic as real `InferenceProvider`s and register them the same way.
