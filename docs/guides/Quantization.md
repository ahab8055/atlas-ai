# Atlas AI — GGUF Quantization Support

Identify quantized GGUF models, recommend levels for hardware, and document tradeoffs (Architecture/25).

Related: [Hardware-Profiles.md](./Hardware-Profiles.md), [Model-Compatibility.md](./Model-Compatibility.md), [Model-Installation.md](./Model-Installation.md), [LlamaCpp-Integration.md](./LlamaCpp-Integration.md), [ADR-0033](../adr/0033-quantization-support.md), [`@atlas-ai/ai`](../../packages/ai/).

---

## Purpose

- **Support quantized GGUF** weights (Q2–Q8, IQ*, F16/F32) via llama.cpp.
- **Detect** quantization level from filenames / registry metadata.
- **Recommend** suitable levels for low / balanced / performance hosts.
- **Document** size / speed / quality tradeoffs.

---

## CLI

```bash
# Recommend quant levels for this machine
pnpm atlas ai quantization

# Detect from a model id or filename
pnpm atlas ai quantization detect general/phi-3-mini-Q4_K_M.gguf

# Full tradeoff table
pnpm atlas ai quantization tradeoffs

# Model recommendations include quant scoring
pnpm atlas ai recommend
```

---

## Detection

Atlas parses common llama.cpp tags from the model id/path:

| Family    | Examples                   |
| --------- | -------------------------- |
| ultra_low | `IQ2_*`, `Q2_K`            |
| low       | `Q3_K_M`, `IQ3_M`          |
| medium    | `Q4_0`, `Q4_K_M`, `IQ4_NL` |
| high      | `Q5_K_M`, `Q6_K`           |
| near_full | `Q8_0`                     |
| full      | `F16`, `BF16`, `F32`       |

On `atlas ai register` / install, quantized models get:

- capability `quantized` (+ lowercase level tag, e.g. `q4_k_m`)
- `requirements.quantization` = `Q4_K_M`

GGUF validation also reports `quantization` / `quantized` when the filename contains a tag.

---

## Hardware recommendations

| Profile          | Preferred                  | Avoid on this profile |
| ---------------- | -------------------------- | --------------------- |
| low (~8GB)       | `Q4_K_M`, `Q4_0`, `Q3_K_M` | `Q8`, `F16`           |
| balanced (~16GB) | `Q5_K_M`, `Q4_K_M`         | heavy `F32`           |
| performance      | `Q6_K`, `Q8_0`, `F16`      | —                     |

`recommendModelsForProfile` boosts models whose quant fits the active profile.

---

## Tradeoffs (summary)

| Family     | Size vs FP16 | Quality            | Best for         |
| ---------- | ------------ | ------------------ | ---------------- |
| ultra_low  | ~15–20%      | Noticeable loss    | Tiny RAM         |
| low        | ~20–25%      | Chat OK            | Tight 8GB        |
| **medium** | **~25–35%**  | **Strong default** | **Consumer PCs** |
| high       | ~35–45%      | Better coding      | 16GB+            |
| near_full  | ~50%         | Near-lossless      | 32GB+ / GPU      |
| full       | 100%+        | Reference          | Workstations     |

Lower quant → smaller file, less RAM, faster load, slightly lower accuracy.

---

## API

```ts
import {
  detectQuantization,
  recommendQuantization,
  formatQuantizationTradeoffs,
} from "@atlas-ai/ai";

const info = detectQuantization("models/general/phi-Q4_K_M.gguf");
// info.level === "Q4_K_M", info.quantized === true

const rec = recommendQuantization({ profileId: "low" });
console.log(rec.preferredLevels); // ["Q4_K_M", "Q4_0", ...]
```

Quantized GGUFs run through the existing `LlamaCppProvider` load path — no separate runtime.

---

## Out of scope

Re-quantizing weights in Atlas, reading `general.file_type` from GGUF KV (filename/metadata tags are MVP), automatic download of alternate quants.
