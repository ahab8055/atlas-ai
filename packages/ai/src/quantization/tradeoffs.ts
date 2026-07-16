/**
 * Documented quantization performance tradeoffs (Architecture/25).
 */
import type { QuantizationFamily, QuantizationTradeoff } from "./types.js";

export const QUANTIZATION_TRADEOFFS: QuantizationTradeoff[] = [
  {
    family: "ultra_low",
    examples: ["IQ2_XXS", "IQ2_M", "Q2_K"],
    sizeVsFp16: "~15–20% of FP16",
    speed: "Fastest load & inference on CPU; lowest RAM",
    quality: "Noticeable quality loss; OK for simple chat",
    bestFor: "≤8GB RAM, CPU-only, very small devices",
  },
  {
    family: "low",
    examples: ["Q3_K_S", "Q3_K_M", "IQ3_M"],
    sizeVsFp16: "~20–25% of FP16",
    speed: "Fast; fits tight RAM budgets",
    quality: "Usable for chat; weaker on complex coding/reasoning",
    bestFor: "8GB RAM machines that struggle with Q4",
  },
  {
    family: "medium",
    examples: ["Q4_0", "Q4_K_S", "Q4_K_M", "IQ4_NL"],
    sizeVsFp16: "~25–35% of FP16",
    speed: "Good balance of speed and size",
    quality: "Strong default for consumer hardware",
    bestFor: "8–16GB RAM — recommended default (Q4_K_M)",
  },
  {
    family: "high",
    examples: ["Q5_0", "Q5_K_M", "Q6_K"],
    sizeVsFp16: "~35–45% of FP16",
    speed: "Slightly slower / more RAM than Q4",
    quality: "Closer to full precision; better coding/reasoning",
    bestFor: "16–32GB RAM or GPU-assisted hosts",
  },
  {
    family: "near_full",
    examples: ["Q8_0"],
    sizeVsFp16: "~50% of FP16",
    speed: "Heavier; still smaller than FP16",
    quality: "Near-lossless for most tasks",
    bestFor: "32GB+ RAM or dedicated GPU with VRAM headroom",
  },
  {
    family: "full",
    examples: ["F16", "BF16", "F32"],
    sizeVsFp16: "100% (F16) / 200% (F32)",
    speed: "Largest & slowest on consumer CPUs",
    quality: "Reference quality",
    bestFor: "Workstations / high-VRAM GPUs — rarely needed for chat",
  },
];

export function tradeoffForFamily(
  family: QuantizationFamily,
): QuantizationTradeoff | undefined {
  return QUANTIZATION_TRADEOFFS.find((t) => t.family === family);
}

export function formatQuantizationTradeoffs(
  families?: QuantizationFamily[],
): string {
  const rows =
    families && families.length > 0
      ? QUANTIZATION_TRADEOFFS.filter((t) => families.includes(t.family))
      : QUANTIZATION_TRADEOFFS;

  const lines = ["Quantization tradeoffs (vs FP16):", ""];
  for (const t of rows) {
    lines.push(
      `${t.family.toUpperCase()} (${t.examples.join(", ")})`,
      `  Size: ${t.sizeVsFp16}`,
      `  Speed: ${t.speed}`,
      `  Quality: ${t.quality}`,
      `  Best for: ${t.bestFor}`,
      "",
    );
  }
  return lines.join("\n").trimEnd();
}
