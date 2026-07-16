# Atlas AI — Hardware Detection

Collects host CPU, RAM, GPU/VRAM, and OS facts for model selection (Architecture/25).

Related: [Hardware-Profiles.md](./Hardware-Profiles.md), [Architecture/25](../Architecture/25-Model-Management-System.md), [Local-AI-Runtime.md](./Local-AI-Runtime.md), [LlamaCpp-Integration.md](./LlamaCpp-Integration.md), [Model-Registry.md](./Model-Registry.md), [ADR-0026](../adr/0026-hardware-detection.md), [ADR-0027](../adr/0027-hardware-profile-management.md), [`@atlas-ai/ai`](../../packages/ai/).

---

## Purpose

- Detect **CPU**, **RAM**, **GPU**, **VRAM** (when reported), and **OS**.
- Classify into a **hardware profile** (`low` | `balanced` | `performance`).
- Suggest a llama.cpp **inference profile** (`acceleration`, `threads`, `gpuLayers`, `contextSize`).
- Feed **model recommendations** (see [Hardware-Profiles.md](./Hardware-Profiles.md)).

---

## CLI

```bash
pnpm atlas ai hardware
pnpm atlas ai profiles
pnpm atlas ai recommend
pnpm atlas ai models    # annotates registry entries with fit=yes/no
```

---

## Programmatic

```ts
import {
  detectHardware,
  evaluateModelSuitability,
  recommendModelsForProfile,
  selectSuitableModels,
} from "@atlas-ai/ai";

const hardware = detectHardware();
console.log(
  hardware.profileId,
  hardware.profile.label,
  hardware.inferenceProfile,
);

const suitable = selectSuitableModels(registry.list(), hardware);
const recs = recommendModelsForProfile(registry.list(), { hardware, limit: 5 });
```

Inject a custom `SystemProbe` in tests to avoid real GPU shell calls.

---

## Detection notes

| Fact           | Source                                                                |
| -------------- | --------------------------------------------------------------------- |
| CPU / RAM / OS | Node `os` module                                                      |
| GPU (macOS)    | `system_profiler SPDisplaysDataType -json` (+ Apple Silicon fallback) |
| GPU (Linux)    | `nvidia-smi` when present                                             |
| GPU (Windows)  | `wmic` video controller query                                         |

GPU probes are best-effort and timed out; missing tools yield CPU-only suggestions.

---

## Out of scope

Automatic rewrite of `config.ai.hardware`, Model Router task routing, download recommendations.
