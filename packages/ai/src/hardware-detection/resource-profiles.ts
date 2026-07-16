/**
 * Hardware profile system — resource categories + low/balanced/performance
 * (Architecture/25 Low Resource / Standard / High Performance).
 */
import type { HardwareProfile } from "../hardware.js";

/**
 * Named device capability profiles (user-story names).
 * Maps to Architecture/25: Low Resource, Standard, High Performance.
 */
export type ResourceProfileId = "low" | "balanced" | "performance";

/**
 * @deprecated Prefer `ResourceProfileId`. Kept for callers that still say "tier".
 * `standard` → balanced, `high` → performance.
 */
export type HardwareTier = ResourceProfileId | "standard" | "high";

/** Resource categories used when classifying a device. */
export type ResourceCategory = "cpu" | "memory" | "gpu" | "acceleration";

export type ModelSizeClass = "small" | "medium" | "large";

export interface ResourceCategoryTargets {
  memory: {
    /** Typical minimum RAM for this profile. */
    minRamGb: number;
    /** Soft upper hint (documentation / UI). */
    maxRamGbHint?: number;
  };
  gpu: {
    required: boolean;
    preferDedicated: boolean;
    minVramGb?: number;
  };
  cpu: {
    minLogicalProcessors?: number;
  };
  acceleration: {
    preferred: "cpu" | "gpu" | "any";
  };
}

export interface ModelRecommendationGuidance {
  sizeClass: ModelSizeClass;
  /** Soft cap on weight file size when known. */
  maxSizeBytes?: number;
  /** Models requiring more RAM than this are deprioritized / excluded. */
  maxMinRamGb: number;
  preferAcceleration: "cpu" | "gpu" | "any";
  preferredCapabilities: string[];
}

export interface ResourceProfileDefinition {
  id: ResourceProfileId;
  label: string;
  description: string;
  /** Architecture/25 naming. */
  architectureName: string;
  categories: ResourceCategoryTargets;
  modelGuidance: ModelRecommendationGuidance;
  defaultInference: Pick<
    HardwareProfile,
    "acceleration" | "gpuLayers" | "contextSize"
  >;
}

export const RESOURCE_PROFILE_IDS: readonly ResourceProfileId[] = [
  "low",
  "balanced",
  "performance",
] as const;

export const RESOURCE_CATEGORIES: readonly ResourceCategory[] = [
  "cpu",
  "memory",
  "gpu",
  "acceleration",
] as const;

/** Canonical profile catalog. */
export const RESOURCE_PROFILES: Record<
  ResourceProfileId,
  ResourceProfileDefinition
> = {
  low: {
    id: "low",
    label: "Low Resource",
    architectureName: "Low Resource",
    description:
      "≈8GB RAM, CPU-only — small quantized models for reliable local inference.",
    categories: {
      memory: { minRamGb: 4, maxRamGbHint: 12 },
      gpu: { required: false, preferDedicated: false },
      cpu: { minLogicalProcessors: 2 },
      acceleration: { preferred: "cpu" },
    },
    modelGuidance: {
      sizeClass: "small",
      maxSizeBytes: 4 * 1024 ** 3,
      maxMinRamGb: 10,
      preferAcceleration: "cpu",
      preferredCapabilities: ["chat", "local"],
    },
    defaultInference: {
      acceleration: "cpu",
      gpuLayers: 0,
      contextSize: 2048,
    },
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    architectureName: "Standard",
    description:
      "≈16–32GB RAM with GPU when available — medium models for everyday work.",
    categories: {
      memory: { minRamGb: 12, maxRamGbHint: 32 },
      gpu: { required: false, preferDedicated: false, minVramGb: 4 },
      cpu: { minLogicalProcessors: 4 },
      acceleration: { preferred: "any" },
    },
    modelGuidance: {
      sizeClass: "medium",
      maxSizeBytes: 12 * 1024 ** 3,
      maxMinRamGb: 24,
      preferAcceleration: "any",
      preferredCapabilities: ["chat", "local", "coding"],
    },
    defaultInference: {
      acceleration: "gpu",
      gpuLayers: 24,
      contextSize: 4096,
    },
  },
  performance: {
    id: "performance",
    label: "Performance",
    architectureName: "High Performance",
    description:
      "≈64GB+ RAM and/or strong dedicated GPU — large models for heavy reasoning.",
    categories: {
      memory: { minRamGb: 32, maxRamGbHint: 128 },
      gpu: { required: false, preferDedicated: true, minVramGb: 8 },
      cpu: { minLogicalProcessors: 8 },
      acceleration: { preferred: "gpu" },
    },
    modelGuidance: {
      sizeClass: "large",
      maxSizeBytes: 40 * 1024 ** 3,
      maxMinRamGb: 64,
      preferAcceleration: "gpu",
      preferredCapabilities: ["chat", "local", "coding", "reasoning"],
    },
    defaultInference: {
      acceleration: "gpu",
      gpuLayers: 99,
      contextSize: 8192,
    },
  },
};

/** Normalize legacy tier ids (`standard`/`high`) to ResourceProfileId. */
export function normalizeResourceProfileId(
  value: string | undefined,
): ResourceProfileId {
  if (value === "balanced" || value === "standard") {
    return "balanced";
  }
  if (value === "performance" || value === "high") {
    return "performance";
  }
  if (value === "low") {
    return "low";
  }
  return "balanced";
}

export function getResourceProfile(
  id: ResourceProfileId | HardwareTier,
): ResourceProfileDefinition {
  return RESOURCE_PROFILES[normalizeResourceProfileId(id)];
}

export function listResourceProfiles(): ResourceProfileDefinition[] {
  return RESOURCE_PROFILE_IDS.map((id) => RESOURCE_PROFILES[id]);
}

/** Rough size class from weight bytes when known. */
export function sizeClassFromBytes(
  sizeBytes?: number,
): ModelSizeClass | undefined {
  if (sizeBytes === undefined) {
    return undefined;
  }
  if (sizeBytes < 4 * 1024 ** 3) {
    return "small";
  }
  if (sizeBytes < 12 * 1024 ** 3) {
    return "medium";
  }
  return "large";
}
