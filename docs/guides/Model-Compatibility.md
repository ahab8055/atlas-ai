# Atlas AI — Model Compatibility

Verify RAM, CPU, GPU, and storage fit before running a model (Architecture/25).

Related: [Model-Installation.md](./Model-Installation.md), [Hardware-Detection.md](./Hardware-Detection.md), [Hardware-Profiles.md](./Hardware-Profiles.md), [Model-Registry.md](./Model-Registry.md), [ADR-0029](../adr/0029-model-compatibility-checker.md), [`@atlas-ai/ai`](../../packages/ai/).

---

## Purpose

- Check **RAM**, **CPU**, **GPU**, and **storage** against model requirements.
- Produce a clear **compatibility result** (supported vs unsupported).
- **Block model load/generate** when hard requirements are not met (`runtime` mode).

Install mode stays advisory (warnings) — see [Model-Installation.md](./Model-Installation.md).

---

## CLI

```bash
pnpm atlas ai check                 # default model from config
pnpm atlas ai check general/phi-3   # specific registry id

# Load/ask enforce the same gate when registry metadata exists
pnpm atlas ai load general/phi-3
```

Exit code `1` when unsupported.

---

## Result shape

```ts
import {
  checkModelCompatibility,
  formatCompatibilityReport,
} from "@atlas-ai/ai";

const result = checkModelCompatibility({
  modelId: "coding/coder",
  requirements: { minRamGb: 16, requireGpu: true, minLogicalProcessors: 8 },
  sizeBytes: 8 * 1024 ** 3,
  modelsDir: "./models",
  mode: "runtime",
});

console.log(formatCompatibilityReport(result));
// result.compatible / result.supported
// result.checks.{ram,cpu,gpu,storage}
// result.issues[]
```

---

## Runtime enforcement

`createAiRuntime({ compatibility: { enabled: true, resolve, modelsDir } })` calls `assertModelCompatible` before `load` / `generate`. Failure throws `AiRuntimeError` with code `model_incompatible`.

---

## Requirement fields

| Field                  | Role                                |
| ---------------------- | ----------------------------------- |
| `minRamGb`             | Host RAM must be ≥                  |
| `minLogicalProcessors` | CPU logical cores must be ≥         |
| `acceleration: "gpu"`  | Hard GPU requirement at **runtime** |
| `requireGpu`           | Explicit hard GPU requirement       |
| `minFreeStorageGb`     | Free disk near models dir           |
| `gpuLayersRecommended` | Soft warning if no GPU              |

---

## Out of scope

Auto-downsizing models, driver installation, live VRAM budgeting beyond detection.
