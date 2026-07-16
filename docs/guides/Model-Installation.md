# Atlas AI — Model Installation

Install supported GGUF models into the controlled `models/` tree and register them (Architecture/25).

Related: [Model-Registry.md](./Model-Registry.md), [Model-Storage.md](./Model-Storage.md), [Hardware-Profiles.md](./Hardware-Profiles.md), [Architecture/25](../Architecture/25-Model-Management-System.md), [ADR-0028](../adr/0028-model-installation-workflow.md), [`@atlas-ai/ai`](../../packages/ai/).

---

## Flow

```
Select source (file or URL)
        ↓
Compatibility check (RAM / GPU / profile) → warnings
        ↓
Storage check (free disk)
        ↓
Download (URL) or use local file
        ↓
Validate GGUF
        ↓
Copy into models/<category>/
        ↓
Register in model registry
        ↓
Available
```

Compatibility issues are **warnings** by default at install time (Architecture/25 example). Hard failures: invalid GGUF, insufficient disk (error), missing source.

Before **running** a model, use [Model-Compatibility.md](./Model-Compatibility.md) — unmet RAM/GPU/CPU/storage requirements block load.

---

## CLI

```bash
# Local file → models/general/
pnpm atlas ai install ./downloads/phi.gguf

# Category folder
pnpm atlas ai install ./coder.gguf coding

# Remote GGUF
pnpm atlas ai install https://example.com/model.gguf general

# Compatibility + storage only
pnpm atlas ai install --dry-run ./phi.gguf

# Speech category nests under speech/stt or speech/tts
pnpm atlas ai install ./whisper.gguf speech --modality stt
pnpm atlas ai install ./piper.gguf speech --modality tts
```

Installed models show up in `pnpm atlas ai models`.

---

## Programmatic

```ts
import { createModelInstaller, createModelRegistry } from "@atlas-ai/ai";

const registry = createModelRegistry({ modelsDir: "./models" });
const installer = createModelInstaller({
  modelsDir: "./models",
  registry,
});

const result = await installer.install({
  source: "./weights/model.gguf",
  category: "general",
  requirements: { minRamGb: 8, acceleration: "cpu" },
});
```

---

## Out of scope

Model marketplace catalog UI, resume/partial downloads, checksum `model.json` sidecars, automatic GPU driver install.
