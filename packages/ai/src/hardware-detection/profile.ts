/**
 * Derive llama.cpp HardwareProfile + model suitability from detection.
 */
import { DEFAULT_CPU_HARDWARE, type HardwareProfile } from "../hardware.js";
import type { ModelRequirements } from "../model-registry/types.js";
import {
  getResourceProfile,
  normalizeResourceProfileId,
  type ResourceProfileId,
} from "./resource-profiles.js";
import type {
  DetectedHardware,
  DetectedGpu,
  ModelSuitabilityResult,
} from "./types.js";

function maxVramGb(gpus: DetectedGpu[]): number | undefined {
  let max: number | undefined;
  for (const gpu of gpus) {
    if (gpu.vramGb === undefined) {
      continue;
    }
    if (max === undefined || gpu.vramGb > max) {
      max = gpu.vramGb;
    }
  }
  return max;
}

/**
 * Suggest inference HardwareProfile for model loading / llama-server.
 * CPU remains default unless a usable GPU/accelerator is detected.
 */
export function suggestInferenceProfile(input: {
  cpuLogicalProcessors: number;
  gpus: DetectedGpu[];
  tier?: ResourceProfileId | string;
  profileId?: ResourceProfileId | string;
  contextSize?: number;
  /** Force CPU even when GPU is present. */
  preferCpu?: boolean;
}): HardwareProfile {
  const profileId = normalizeResourceProfileId(input.profileId ?? input.tier);
  const defaults = getResourceProfile(profileId).defaultInference;
  const gpuAvailable =
    !input.preferCpu && input.gpus.some((gpu) => gpu.available);
  const threads =
    input.cpuLogicalProcessors > 0 ? input.cpuLogicalProcessors : 0;
  const contextSize = input.contextSize ?? defaults.contextSize;

  if (!gpuAvailable) {
    return {
      ...DEFAULT_CPU_HARDWARE,
      threads,
      contextSize,
      acceleration: "cpu",
      gpuLayers: 0,
    };
  }

  const vram = maxVramGb(input.gpus);
  let gpuLayers = defaults.gpuLayers;
  if (vram !== undefined) {
    if (vram >= 16) {
      gpuLayers = 99;
    } else if (vram >= 8) {
      gpuLayers = 40;
    } else if (vram >= 4) {
      gpuLayers = 24;
    } else {
      gpuLayers = 12;
    }
  } else if (input.gpus.some((g) => g.vendor === "Apple")) {
    gpuLayers = profileId === "performance" ? 99 : 40;
  }

  return {
    acceleration: "gpu",
    threads,
    gpuLayers,
    contextSize,
  };
}

/**
 * Whether a registered model\'s requirements fit the detected host.
 * Used by model recommendation / selection logic.
 */
export function evaluateModelSuitability(
  requirements: ModelRequirements | undefined,
  hardware: Pick<
    DetectedHardware,
    "memory" | "gpus" | "gpuAvailable" | "tier"
  > & { profileId?: ResourceProfileId },
): ModelSuitabilityResult {
  const reasons: string[] = [];
  const req = requirements ?? {};

  if (
    typeof req.minRamGb === "number" &&
    hardware.memory.totalGb + 1e-9 < req.minRamGb
  ) {
    reasons.push(
      `needs ≥${req.minRamGb}GB RAM (host has ${hardware.memory.totalGb}GB)`,
    );
  }

  if (req.acceleration === "gpu" && !hardware.gpuAvailable) {
    reasons.push("requires GPU acceleration but no GPU was detected");
  }

  if (
    typeof req.gpuLayersRecommended === "number" &&
    req.gpuLayersRecommended > 0 &&
    !hardware.gpuAvailable
  ) {
    reasons.push(
      `recommends ${req.gpuLayersRecommended} GPU layers but no GPU was detected`,
    );
  }

  return {
    suitable: reasons.length === 0,
    reasons,
  };
}

/**
 * Filter models that fit the detected hardware (model selection helper).
 */
export function selectSuitableModels<
  T extends { requirements?: ModelRequirements; id: string },
>(models: T[], hardware: DetectedHardware): T[] {
  return models.filter(
    (model) => evaluateModelSuitability(model.requirements, hardware).suitable,
  );
}
