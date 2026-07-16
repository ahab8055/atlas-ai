/**
 * Classify host into low / balanced / performance profiles (Architecture/25).
 */
import {
  normalizeResourceProfileId,
  type ResourceProfileId,
} from "./resource-profiles.js";
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
 * Classify device capability into a resource profile.
 *
 * - low: ~8GB RAM, CPU-only → small quantized models
 * - balanced: ~16–32GB, GPU available → medium models (Arch "Standard")
 * - performance: ~64GB+ or strong dedicated GPU → large models
 */
export function classifyResourceProfile(
  input: ClassifyInput,
): ResourceProfileId {
  const { totalRamGb, gpus } = input;
  const gpuAvailable = gpus.some((gpu) => gpu.available);
  const dedicated = hasDedicatedGpu(gpus);
  const vram = maxVramGb(gpus);

  if (
    totalRamGb >= 48 ||
    (dedicated && vram >= 8 && totalRamGb >= 24) ||
    (totalRamGb >= 32 && dedicated && vram >= 12)
  ) {
    return "performance";
  }

  if (totalRamGb < 12 && !gpuAvailable) {
    return "low";
  }

  if (totalRamGb < 10) {
    return "low";
  }

  return "balanced";
}

/**
 * @deprecated Use `classifyResourceProfile`. Returns the same ids
 * (`low` | `balanced` | `performance`).
 */
export function classifyHardwareTier(input: ClassifyInput): HardwareTier {
  return classifyResourceProfile(input);
}

export { normalizeResourceProfileId };
