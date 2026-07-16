/**
 * Architecture/25 Low / Standard / High hardware profiles.
 */
import type { DetectedGpu, HardwareTier } from "./types.js";

export interface ClassifyInput {
  totalRamGb: number;
  gpus: DetectedGpu[];
}

function hasDedicatedGpu(gpus: DetectedGpu[]): boolean {
  return gpus.some((gpu) => gpu.available && !gpu.integrated);
}

function maxVramGb(gpus: DetectedGpu[]): number {
  let max = 0;
  for (const gpu of gpus) {
    if (gpu.vramGb !== undefined && gpu.vramGb > max) {
      max = gpu.vramGb;
    }
  }
  return max;
}

/**
 * Classify host into Architecture/25 resource tiers.
 *
 * - Low: ~8GB RAM, CPU-only → small quantized models
 * - Standard: ~16–32GB, GPU available → medium models
 * - High: ~64GB+ or strong dedicated GPU → large models
 */
export function classifyHardwareTier(input: ClassifyInput): HardwareTier {
  const { totalRamGb, gpus } = input;
  const gpuAvailable = gpus.some((gpu) => gpu.available);
  const dedicated = hasDedicatedGpu(gpus);
  const vram = maxVramGb(gpus);

  if (
    totalRamGb >= 48 ||
    (dedicated && vram >= 8 && totalRamGb >= 24) ||
    (totalRamGb >= 32 && dedicated && vram >= 12)
  ) {
    return "high";
  }

  if (totalRamGb < 12 && !gpuAvailable) {
    return "low";
  }

  if (totalRamGb < 10) {
    return "low";
  }

  return "standard";
}
