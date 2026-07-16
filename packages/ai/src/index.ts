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

export type {
  InferenceProvider,
  ProviderDescriptor,
  ProviderKind,
} from "./provider.js";

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
  type RuntimeRouterOptions,
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
  CloudStubInferenceProvider,
  type CloudStubInferenceProviderOptions,
} from "./providers/cloud-stub.js";

export {
  registerBuiltinProviders,
  type RegisterBuiltinProvidersOptions,
} from "./providers/register.js";

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
  ModelRouter,
  analyzeTask,
  createModelRouter,
  formatRoutingDecision,
  routeModel,
  type ComplexityLevel,
  type ModelRouterOptions,
  type RouteModelInput,
  type RoutingDecision,
  type RoutingMode,
  type TaskAnalysis,
  type TaskType,
} from "./model-router/index.js";

export {
  ModelRuntimeManager,
  buildMemoryState,
  createModelRuntimeManager,
  defaultMemoryBudgetBytes,
  estimateModelMemoryBytes,
  formatBytesShort,
  formatRuntimeSnapshot,
  sumEstimatedMemory,
  type InferenceSession,
  type InferenceSessionStatus,
  type LoadedModelState,
  type ModelRuntimeManagerOptions,
  type ModelRuntimePhase,
  type ModelRuntimeSnapshot,
  type RuntimeMemoryState,
} from "./model-runtime/index.js";

export {
  AiRuntimeMonitor,
  DEFAULT_SLOW_INFERENCE_MS,
  DEFAULT_SLOW_LOAD_MS,
  buildMetricWarnings,
  createAiRuntimeMonitor,
  formatAiRuntimeMetricEvent,
  formatAiRuntimeMetrics,
  formatAiRuntimeRecentEvents,
  resolveThresholds,
  type AiRuntimeErrorEvent,
  type AiRuntimeInferenceEvent,
  type AiRuntimeLoadEvent,
  type AiRuntimeMetricEvent,
  type AiRuntimeMetricKind,
  type AiRuntimeMetrics,
  type AiRuntimeMetricsWarning,
  type AiRuntimeMonitorOptions,
  type AiRuntimeStatusEvent,
  type TimingStats,
} from "./runtime-monitoring/index.js";

export {
  OFFLINE_LIMITATIONS,
  assertNetworkOperationAllowed,
  assessOfflineCapability,
  blockedOperationsWhenOffline,
  formatOfflineModeStatus,
  isLoopbackHostname,
  isLoopbackUrl,
  probeInternetReachability,
  type AssessOfflineCapabilityInput,
  type InternetReachability,
  type NetworkOperation,
  type OfflineBlockedOperation,
  type OfflineModeStatus,
  type OfflinePolicyContext,
  type ProbeInternetOptions,
} from "./offline/index.js";

export {
  QUANTIZATION_TRADEOFFS,
  detectQuantization,
  familyForLevel,
  formatQuantizationInfo,
  formatQuantizationRecommendation,
  formatQuantizationTradeoffs,
  isQuantizedGguf,
  normalizeQuantLevel,
  recommendQuantization,
  scoreQuantizationFit,
  tradeoffForFamily,
  type QuantizationFamily,
  type QuantizationInfo,
  type QuantizationLevel,
  type QuantizationRecommendation,
  type QuantizationTradeoff,
  type RecommendQuantizationOptions,
} from "./quantization/index.js";

export {
  EmbeddingService,
  HttpEmbeddingProvider,
  InMemoryEmbeddingStore,
  MockEmbeddingProvider,
  assertValidVector,
  cosineSimilarity,
  createEmbeddingService,
  createPersistentEmbeddingStore,
  deserializeEmbedding,
  hashTextToVector,
  serializeEmbedding,
  type EmbedBatchInput,
  type EmbedResult,
  type EmbedTextInput,
  type EmbeddingCollection,
  type EmbeddingModelInfo,
  type EmbeddingProvider,
  type EmbeddingProviderHealth,
  type EmbeddingQuery,
  type EmbeddingRecord,
  type EmbeddingServiceOptions,
  type EmbeddingStore,
  type EmbeddingVector,
  type FindSimilarOptions,
  type HttpEmbeddingProviderOptions,
  type MockEmbeddingProviderOptions,
  type PersistentEmbeddingRow,
  type PersistentEmbeddingsApi,
  type SimilarityMatch,
  type StoreEmbeddingInput,
} from "./embeddings/index.js";

export {
  SPEECH_FILE_EXTENSIONS,
  SPEECH_MODALITIES,
  SpeechModelManager,
  MockSpeechToTextProvider,
  MockTextToSpeechProvider,
  createSpeechModelManager,
  ensureSpeechStructure,
  isSpeechStructureReady,
  listSpeechFiles,
  modalityFromRegistered,
  scanSpeechModels,
  speechDestinationPath,
  speechMetadataFromFile,
  speechModalityPath,
  type AudioInput,
  type AudioOutput,
  type EnsureSpeechStructureResult,
  type MockSpeechToTextOptions,
  type MockTextToSpeechOptions,
  type ScanSpeechModelsOptions,
  type SpeechFileEntry,
  type SpeechModality,
  type SpeechModelFormat,
  type SpeechModelInfo,
  type SpeechModelManagerOptions,
  type SpeechModelMetadata,
  type SpeechProviderHealth,
  type SpeechToTextProvider,
  type SynthesizeInput,
  type TextToSpeechProvider,
  type TranscriptResult,
} from "./speech/index.js";

export {
  DEFAULT_INFERENCE_PARAMS,
  inferenceParamsToApiBody,
  mergeInferenceParams,
  type InferenceParams,
} from "./inference-params.js";

export {
  DEFAULT_INFERENCE_CONFIG,
  INFERENCE_CONFIG_BOUNDS,
  INFERENCE_SETTINGS_FILENAME,
  InferenceConfigManager,
  configFromAtlasDefaults,
  createFileInferenceSettingsStore,
  createInferenceConfigManager,
  createMemoryInferenceSettingsStore,
  emptyStoredSettings,
  formatInferenceConfig,
  inferenceSettingsPath,
  mergeInferenceConfig,
  resolveInferenceConfig,
  sanitizeInferencePatch,
  sanitizeStoredSettings,
  toInferenceParams,
  type InferenceConfig,
  type InferenceConfigManagerOptions,
  type InferenceConfigPatch,
  type InferenceSettingsStore,
  type ResolvedInferenceConfig,
  type StoredInferenceSettings,
} from "./inference-config/index.js";
