export type {
  DetectedCpu,
  DetectedGpu,
  DetectedHardware,
  DetectedMemory,
  DetectedOs,
  HardwareTier,
  ModelSuitabilityResult,
} from "./types.js";

export {
  createNodeSystemProbe,
  type CommandResult,
  type SystemProbe,
} from "./probe.js";

export { detectGpus } from "./gpu.js";

export {
  classifyHardwareTier,
  classifyResourceProfile,
  normalizeResourceProfileId,
} from "./classify.js";

export {
  RESOURCE_CATEGORIES,
  RESOURCE_PROFILES,
  RESOURCE_PROFILE_IDS,
  getResourceProfile,
  listResourceProfiles,
  sizeClassFromBytes,
  type ModelSizeClass,
  type ModelRecommendationGuidance,
  type ResourceCategory,
  type ResourceCategoryTargets,
  type ResourceProfileDefinition,
  type ResourceProfileId,
} from "./resource-profiles.js";

export {
  evaluateModelSuitability,
  selectSuitableModels,
  suggestInferenceProfile,
} from "./profile.js";

export {
  recommendModelsForProfile,
  resolveActiveResourceProfile,
  type ModelRecommendation,
  type RecommendModelsOptions,
  type RecommendableModel,
} from "./recommend.js";

export { detectHardware, type DetectHardwareOptions } from "./detect.js";
