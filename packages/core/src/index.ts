export type {
  AtlasEvent,
  CoreAtlasEvent,
  CoreEventPayloadMap,
  CoreEventType,
  EventHandler,
  OrchestrationEvent,
  PublishInput,
  Unsubscribe,
} from "./events/index.js";
export {
  CORE_EVENTS,
  EventBus,
  ORCHESTRATION_EVENTS,
  assertAtlasEvent,
  getDefaultEventBus,
  isCoreEventType,
  publishCoreEvent,
  setDefaultEventBus,
} from "./events/index.js";

export {
  AtlasError,
  classifyCategory,
  createAtlasError,
  ErrorHandler,
  formatErrorCategory,
  fromUnknown,
  getDefaultErrorHandler,
  handleError,
  isAtlasErrorResponse,
  markRecoveryAttempted,
  setDefaultErrorHandler,
  suggestRecovery,
  ERROR_CATEGORY_LABELS,
} from "./errors/index.js";
export type {
  AtlasErrorResponse,
  ClassifyErrorInput,
  ErrorCategory,
  HandleErrorOptions,
  RecoveryAction,
  RecoveryStrategy,
} from "./errors/index.js";

export { normalizeRequest } from "./normalize.js";
export { runPipeline } from "./pipeline.js";
export type { PipelineOptions } from "./pipeline.js";

export {
  createRequestHandler,
  handleRequest,
  type RequestHandlerOptions,
} from "./handler.js";

export {
  BUILTIN_INTENT_DEFINITIONS,
  detectIntent,
  getDefaultIntentRegistry,
  IntentRegistry,
  registerIntent,
  toDetectedIntent,
  unknownIntent,
  type DetectIntentOptions,
  type IntentDefinition,
  type IntentMatchResult,
} from "./intent/index.js";

export {
  ContextManager,
  attachContextPackage,
  buildContextPackage,
  createActiveTasksProvider,
  createConversationProvider,
  createKnowledgeProvider,
  createMemoryProvider,
  createPreferencesProvider,
  createProjectProvider,
  createSystemStateProvider,
  DEFAULT_CONTEXT_BUILDER_OPTIONS,
  getDefaultContextManager,
  InMemoryActiveTaskStore,
  InMemoryConversationStore,
  InMemoryPreferenceStore,
  loadContext,
  setDefaultContextManager,
  summarizeConversation,
  type ActiveTaskStore,
  type ContextBuilderOptions,
  type ContextManagerOptions,
  type ContextPackage,
  type ContextProvider,
  type ContextSection,
  type ConversationStore,
  type KnowledgeRetriever,
  type LoadContextOptions,
  type MemoryRetriever,
  type PreferenceStore,
} from "./context/index.js";

export {
  BUILTIN_PLAN_TEMPLATES,
  createPlan,
  draftStep,
  finalizePlan,
  formatPlanSteps,
  getDefaultPlanRegistry,
  orderSteps,
  PlanRegistry,
  registerPlanTemplate,
  type CreatePlanOptions,
  type PlanInput,
  type PlanStepDraft,
  type PlanTemplate,
} from "./planning/index.js";

export {
  ExecutionController,
  executePlan,
  executeToolStep,
  getDefaultExecutionController,
  setDefaultExecutionController,
  type ExecuteOptions,
  type ExecutePlanOptions,
} from "./execution/index.js";

export {
  getDefaultToolRegistry,
  listToolMetadata,
  listTools,
  registerTool,
  ToolRegistry,
  ToolExecutor,
  executeTool,
  getDefaultToolExecutor,
} from "@atlas-ai/tools";

export {
  generateResponse,
  getDefaultResponseGenerator,
  ResponseGenerator,
  setDefaultResponseGenerator,
} from "./response/index.js";

export type {
  ActiveTask,
  ContextSourceId,
  ConversationContext,
  ConversationTurn,
  DetectedIntent,
  ExecutionFailure,
  ExecutionLifecycleState,
  ExecutionPlan,
  ExecutionProgress,
  ExecutionResult,
  ExecutionStatus,
  ExecutionTask,
  GenerateResponseInput,
  IncomingRequest,
  InputSource,
  IntentCategory,
  IntentComplexity,
  IntentParameters,
  KnowledgeSnippet,
  LoadedContext,
  MemorySnippet,
  NormalizedRequest,
  PipelineResponse,
  PipelineResult,
  PipelineStageName,
  PlanKind,
  PlanStep,
  ProjectContext,
  ResponseGeneratorOptions,
  ResponseModality,
  StepResult,
  StepStatus,
  SystemStateInfo,
  UserPreferences,
} from "./types.js";
