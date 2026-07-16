export type {
  AiRuntimeOptions,
  ChatMessage,
  ChatRole,
  GenerateRequest,
  GenerateResult,
  ModelFormat,
  ModelInfo,
  ModelStatus,
  RuntimeHealth,
  StreamChunk,
} from "./types.js";

export type { InferenceProvider } from "./provider.js";

export { AiRuntimeError } from "./errors.js";

export {
  InferenceProviderRegistry,
  getDefaultProviderRegistry,
  setDefaultProviderRegistry,
} from "./registry.js";

export {
  AiRuntime,
  createAiRuntime,
  getDefaultAiRuntime,
  setDefaultAiRuntime,
  type AiRuntimeCreateOptions,
  type ModelCompatibilityResolver,
  type RuntimeCompatibilityOptions,
} from "./runtime.js";

export {
  MockInferenceProvider,
  type MockInferenceProviderOptions,
} from "./providers/mock.js";

export {
  LlamaCppProvider,
  type LlamaCppProviderOptions,
} from "./providers/llamacpp.js";

export {
  ModelRegistry,
  createModelRegistry,
  createPersistentModelRegistryStore,
  InMemoryModelRegistryStore,
  scanInstalledGgufModels,
  type ModelRegistryOptions,
  type ModelRegistryQuery,
  type ModelRegistryStore,
  type ModelRequirements as RegistryModelRequirements,
  type PersistentModelsApi,
  type RegisterModelInput,
  type RegisteredModel,
  type ScanInstalledModelsOptions,
} from "./model-registry/index.js";

export {
  MODEL_CATEGORIES,
  ModelStorageManager,
  categoryPath,
  createModelStorageManager,
  ensureModelDirectoryStructure,
  isStructureReady,
  listStoredGgufFiles,
  resolveStoredModelPath,
  type CategoryUsage,
  type EnsureStructureResult,
  type ModelCategory,
  type ModelRemovalResult,
  type ModelStorageManagerOptions,
  type ModelStorageSlot,
  type StorageUsageReport,
  type StoredModelFile,
} from "./model-storage/index.js";

export {
  ModelInstaller,
  checkInstallCompatibility,
  checkInstallStorage,
  createModelInstaller,
  downloadModelFile,
  getFileSizeBytes,
  getFreeDiskBytes,
  installModel,
  isHttpUrl,
  type CompatibilityCheckInput,
  type CompatibilityReport,
  type CompatibilityWarning,
  type InstallModelInput,
  type InstallModelResult,
  type InstallSourceKind,
  type ModelInstallerOptions,
  type StorageCheckResult,
} from "./model-install/index.js";

export {
  assertModelCompatible,
  checkModelCompatibility,
  formatCompatibilityReport,
  type CategoryCheckResult,
  type CompatibilityIssue,
  type CompatibilityIssueCategory,
  type CompatibilityIssueCode,
  type CompatibilityMode,
  type ModelCompatibilityInput,
  type ModelCompatibilityResult,
} from "./model-compatibility/index.js";

export {
  buildLlamaServerArgs,
  LlamaServerProcess,
  parseEndpoint,
  type LlamaServerLaunchOptions,
} from "./providers/llama-server-process.js";

export {
  GGUF_MAGIC,
  requireValidGguf,
  resolveGgufPath,
  validateGgufFile,
  type GgufValidationResult,
} from "./gguf.js";

export {
  DEFAULT_CPU_HARDWARE,
  mergeHardwareProfile,
  resolveGpuLayers,
  type AccelerationMode,
  type HardwareProfile,
} from "./hardware.js";

export {
  RESOURCE_CATEGORIES,
  RESOURCE_PROFILES,
  RESOURCE_PROFILE_IDS,
  classifyHardwareTier,
  classifyResourceProfile,
  createNodeSystemProbe,
  detectHardware,
  detectGpus,
  evaluateModelSuitability,
  getResourceProfile,
  listResourceProfiles,
  normalizeResourceProfileId,
  recommendModelsForProfile,
  resolveActiveResourceProfile,
  selectSuitableModels,
  sizeClassFromBytes,
  suggestInferenceProfile,
  type CommandResult,
  type DetectHardwareOptions,
  type DetectedCpu,
  type DetectedGpu,
  type DetectedHardware,
  type DetectedMemory,
  type DetectedOs,
  type HardwareTier,
  type ModelRecommendation,
  type ModelSizeClass,
  type ModelSuitabilityResult,
  type RecommendModelsOptions,
  type RecommendableModel,
  type ResourceCategory,
  type ResourceProfileDefinition,
  type ResourceProfileId,
  type SystemProbe,
} from "./hardware-detection/index.js";

export {
  DEFAULT_INFERENCE_PARAMS,
  inferenceParamsToApiBody,
  mergeInferenceParams,
  type InferenceParams,
} from "./inference-params.js";
