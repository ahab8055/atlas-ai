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
  DEFAULT_INFERENCE_PARAMS,
  inferenceParamsToApiBody,
  mergeInferenceParams,
  type InferenceParams,
} from "./inference-params.js";
