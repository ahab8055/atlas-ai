/**
 * Recommend GGUF quantization levels for a hardware / resource profile.
 */
import {
  normalizeResourceProfileId,
  type ResourceProfileId,
} from "../hardware-detection/resource-profiles.js";
import type { DetectedHardware } from "../hardware-detection/types.js";
import { detectQuantization } from "./detect.js";
import {
  formatQuantizationTradeoffs,
  QUANTIZATION_TRADEOFFS,
  tradeoffForFamily,
} from "./tradeoffs.js";
import type {
  QuantizationFamily,
  QuantizationInfo,
  QuantizationLevel,
  QuantizationRecommendation,
} from "./types.js";

const PROFILE_PRESETS: Record<
  ResourceProfileId,
  {
    preferredFamily: QuantizationFamily;
    preferredLevels: QuantizationLevel[];
    acceptableFamilies: QuantizationFamily[];
    reasons: string[];
  }
> = {
  low: {
    preferredFamily: "medium",
    preferredLevels: ["Q4_K_M", "Q4_0", "Q4_K_S", "Q3_K_M"],
    acceptableFamilies: ["medium", "low", "ultra_low"],
    reasons: [
      "Low-resource hosts (~8GB RAM) need smaller weights",
      "Q4_K_M is the usual sweet spot; fall back to Q3 if RAM is tight",
      "Avoid Q8/F16 on CPU-only low-RAM machines",
    ],
  },
  balanced: {
    preferredFamily: "high",
    preferredLevels: ["Q5_K_M", "Q4_K_M", "Q5_0", "Q6_K"],
    acceptableFamilies: ["high", "medium", "near_full"],
    reasons: [
      "Balanced hosts (≈16GB) can run Q5 for better quality",
      "Q4_K_M remains a safe, fast alternative",
      "Q8/F16 only if free RAM/VRAM is plentiful",
    ],
  },
  performance: {
    preferredFamily: "near_full",
    preferredLevels: ["Q6_K", "Q8_0", "Q5_K_M", "F16"],
    acceptableFamilies: ["near_full", "high", "full", "medium"],
    reasons: [
      "Performance hosts can afford higher-quality quants",
      "Q6_K / Q8_0 improve coding and reasoning fidelity",
      "F16 when GPU VRAM or unified memory is large enough",
    ],
  },
};

export interface RecommendQuantizationOptions {
  profileId?: ResourceProfileId | string;
  hardware?: Pick<
    DetectedHardware,
    "profileId" | "tier" | "memory" | "gpuAvailable"
  >;
}

/**
 * Recommend quantization levels for the active (or explicit) hardware profile.
 */
export function recommendQuantization(
  options: RecommendQuantizationOptions = {},
): QuantizationRecommendation {
  const profileId = normalizeResourceProfileId(
    options.profileId ??
      options.hardware?.profileId ??
      options.hardware?.tier ??
      "balanced",
  );
  const preset = PROFILE_PRESETS[profileId];
  const reasons = [...preset.reasons];

  if (options.hardware?.memory) {
    const ram = options.hardware.memory.totalGb;
    if (ram < 10 && profileId !== "low") {
      reasons.push(
        `Host RAM ${ram}GB — prefer Q4/Q3 even if profile is ${profileId}`,
      );
    }
    if (ram >= 24 && profileId === "performance") {
      reasons.push(`Host RAM ${ram}GB supports Q8 / F16 when desired`);
    }
  }
  if (options.hardware?.gpuAvailable === false && profileId === "performance") {
    reasons.push("No GPU detected — prefer Q5/Q6 over F16 on CPU");
  }

  const tradeoffs = preset.acceptableFamilies
    .map((f) => tradeoffForFamily(f))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  return {
    profileId,
    preferredFamily: preset.preferredFamily,
    preferredLevels: [...preset.preferredLevels],
    acceptableFamilies: [...preset.acceptableFamilies],
    reasons,
    tradeoffs:
      tradeoffs.length > 0
        ? tradeoffs
        : QUANTIZATION_TRADEOFFS.filter((t) =>
            preset.acceptableFamilies.includes(t.family),
          ),
  };
}

/**
 * Score how well a model's quantization fits a recommendation.
 * Higher is better (0–40 typical).
 */
export function scoreQuantizationFit(
  info: QuantizationInfo | string,
  recommendation: QuantizationRecommendation,
): { score: number; reason: string } {
  const quant = typeof info === "string" ? detectQuantization(info) : info;

  if (quant.family === "unknown") {
    return { score: 5, reason: "quantization unknown — neutral" };
  }

  const levelIdx = quant.level
    ? recommendation.preferredLevels.indexOf(quant.level)
    : -1;
  if (levelIdx === 0) {
    return { score: 40, reason: `preferred level ${quant.level}` };
  }
  if (levelIdx > 0) {
    return {
      score: 30 - levelIdx * 3,
      reason: `preferred list #${levelIdx + 1}: ${quant.level}`,
    };
  }

  if (quant.family === recommendation.preferredFamily) {
    return {
      score: 25,
      reason: `matches preferred family ${quant.family}`,
    };
  }

  if (recommendation.acceptableFamilies.includes(quant.family)) {
    return {
      score: 15,
      reason: `acceptable family ${quant.family}`,
    };
  }

  // Penalize full precision on low profiles
  if (
    recommendation.profileId === "low" &&
    (quant.family === "full" || quant.family === "near_full")
  ) {
    return {
      score: -20,
      reason: `${quant.level ?? quant.family} too heavy for low-resource host`,
    };
  }

  return {
    score: 0,
    reason: `family ${quant.family} not preferred for ${recommendation.profileId}`,
  };
}

export function formatQuantizationRecommendation(
  rec: QuantizationRecommendation,
): string {
  const lines = [
    `Quantization recommendation (${rec.profileId}):`,
    `Preferred family: ${rec.preferredFamily}`,
    `Preferred levels: ${rec.preferredLevels.join(", ")}`,
    `Acceptable families: ${rec.acceptableFamilies.join(", ")}`,
    "Reasons:",
    ...rec.reasons.map((r) => `  - ${r}`),
    "",
    formatQuantizationTradeoffs(rec.acceptableFamilies),
  ];
  return lines.join("\n");
}
