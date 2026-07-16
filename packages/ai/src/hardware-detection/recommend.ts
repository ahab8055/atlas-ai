/**
 * Map hardware profiles to ranked model recommendations.
 */
import type { ModelRequirements } from "../model-registry/types.js";
import {
  detectQuantization,
  recommendQuantization,
  scoreQuantizationFit,
} from "../quantization/index.js";
import {
  getResourceProfile,
  normalizeResourceProfileId,
  sizeClassFromBytes,
  type ModelSizeClass,
  type ResourceProfileId,
  type ResourceProfileDefinition,
} from "./resource-profiles.js";
import { evaluateModelSuitability } from "./profile.js";
import type { DetectedHardware } from "./types.js";

export interface RecommendableModel {
  id: string;
  name?: string;
  sizeBytes?: number;
  capabilities?: string[];
  requirements?: ModelRequirements;
  status?: string;
  provider?: string;
  format?: string;
  /** Detected or declared GGUF quantization (e.g. Q4_K_M). */
  quantization?: string;
}

export interface ModelRecommendation<
  T extends RecommendableModel = RecommendableModel,
> {
  model: T;
  profileId: ResourceProfileId;
  score: number;
  reasons: string[];
  sizeClass?: ModelSizeClass;
  quantization?: string;
}

export interface RecommendModelsOptions {
  profileId?: ResourceProfileId | string;
  /** When set, unsuitable hosts are excluded via evaluateModelSuitability. */
  hardware?: Pick<
    DetectedHardware,
    "memory" | "gpus" | "gpuAvailable" | "tier" | "profileId"
  >;
  limit?: number;
  /** Include models that only partially match (lower score). Default false. */
  includeMarginal?: boolean;
  /** Override profile default size class (e.g. task router complexity). */
  preferredSizeClass?: ModelSizeClass;
}

function sizeClassScore(
  modelClass: ModelSizeClass | undefined,
  wanted: ModelSizeClass,
): { score: number; reason?: string } {
  if (!modelClass) {
    return { score: 5, reason: "size unknown — neutral" };
  }
  if (modelClass === wanted) {
    return { score: 40, reason: `matches ${wanted} size class` };
  }
  const order: ModelSizeClass[] = ["small", "medium", "large"];
  const distance = Math.abs(order.indexOf(modelClass) - order.indexOf(wanted));
  if (distance === 1) {
    return { score: 15, reason: `near size class (${modelClass})` };
  }
  return { score: -25, reason: `size class ${modelClass} far from ${wanted}` };
}

/**
 * Score and rank catalog models for a resource profile (and optional host).
 */
export function recommendModelsForProfile<T extends RecommendableModel>(
  models: T[],
  options: RecommendModelsOptions = {},
): ModelRecommendation<T>[] {
  const profileId = normalizeResourceProfileId(
    options.profileId ?? options.hardware?.profileId ?? options.hardware?.tier,
  );
  const profile = getResourceProfile(profileId);
  const guidance = profile.modelGuidance;
  const results: ModelRecommendation<T>[] = [];

  for (const model of models) {
    const reasons: string[] = [];
    let score = 0;
    const req = model.requirements ?? {};

    if (options.hardware) {
      const fit = evaluateModelSuitability(req, {
        memory: options.hardware.memory,
        gpus: options.hardware.gpus,
        gpuAvailable: options.hardware.gpuAvailable,
        tier: profileId,
      });
      if (!fit.suitable) {
        if (!options.includeMarginal) {
          continue;
        }
        score -= 50;
        reasons.push(...fit.reasons.map((r) => `host: ${r}`));
      } else {
        score += 20;
        reasons.push("fits detected host");
      }
    }

    if (
      model.status &&
      model.status !== "available" &&
      model.status !== "loaded"
    ) {
      if (!options.includeMarginal) {
        continue;
      }
      score -= 20;
      reasons.push(`status=${model.status}`);
    } else {
      score += 5;
    }

    const minRam = req.minRamGb;
    if (typeof minRam === "number") {
      if (minRam > guidance.maxMinRamGb) {
        if (!options.includeMarginal) {
          continue;
        }
        score -= 40;
        reasons.push(
          `minRam ${minRam}GB exceeds profile cap ${guidance.maxMinRamGb}GB`,
        );
      } else {
        score += 15;
        reasons.push(`minRam ${minRam}GB within profile`);
      }
    }

    if (
      guidance.maxSizeBytes !== undefined &&
      model.sizeBytes !== undefined &&
      model.sizeBytes > guidance.maxSizeBytes
    ) {
      if (!options.includeMarginal) {
        continue;
      }
      score -= 30;
      reasons.push("weight larger than profile maxSizeBytes");
    }

    const modelClass = sizeClassFromBytes(model.sizeBytes);
    const wantedSizeClass = options.preferredSizeClass ?? guidance.sizeClass;
    const sizePart = sizeClassScore(modelClass, wantedSizeClass);
    score += sizePart.score;
    if (sizePart.reason) {
      reasons.push(sizePart.reason);
    }

    if (req.acceleration === "gpu" && guidance.preferAcceleration === "cpu") {
      score -= 15;
      reasons.push("model prefers GPU; profile is CPU-oriented");
    } else if (
      req.acceleration === "cpu" &&
      guidance.preferAcceleration === "gpu"
    ) {
      score += 5;
      reasons.push("CPU model still usable on performance hosts");
    } else if (
      guidance.preferAcceleration !== "any" &&
      (req.acceleration === guidance.preferAcceleration ||
        req.acceleration === "any" ||
        req.acceleration === undefined)
    ) {
      score += 10;
      reasons.push(`acceleration aligns with ${guidance.preferAcceleration}`);
    }

    const caps = model.capabilities ?? [];
    const matchedCaps = guidance.preferredCapabilities.filter((c) =>
      caps.includes(c),
    );
    if (matchedCaps.length > 0) {
      score += matchedCaps.length * 5;
      reasons.push(`capabilities: ${matchedCaps.join(",")}`);
    }

    const explicitQuant =
      model.quantization ??
      (typeof model.requirements?.quantization === "string"
        ? String(model.requirements.quantization)
        : undefined);
    const quantInfo = detectQuantization(model.id, explicitQuant);
    const quantRec = recommendQuantization({
      profileId,
      hardware: options.hardware,
    });
    const quantFit = scoreQuantizationFit(quantInfo, quantRec);
    score += quantFit.score;
    reasons.push(`quant: ${quantFit.reason}`);

    results.push({
      model,
      profileId,
      score,
      reasons,
      sizeClass: modelClass,
      quantization: quantInfo.level,
    });
  }

  results.sort(
    (a, b) => b.score - a.score || a.model.id.localeCompare(b.model.id),
  );
  const limit =
    typeof options.limit === "number" && options.limit > 0
      ? Math.floor(options.limit)
      : undefined;
  return limit ? results.slice(0, limit) : results;
}

/**
 * Resolve active profile definition from detection (or explicit id).
 */
export function resolveActiveResourceProfile(
  hardwareOrId: DetectedHardware | ResourceProfileId | string,
): ResourceProfileDefinition {
  if (typeof hardwareOrId === "string") {
    return getResourceProfile(normalizeResourceProfileId(hardwareOrId));
  }
  return getResourceProfile(
    hardwareOrId.profileId ?? normalizeResourceProfileId(hardwareOrId.tier),
  );
}
