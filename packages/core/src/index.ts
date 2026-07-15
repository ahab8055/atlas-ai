export type { OrchestrationEvent } from "./events.js";
export { ORCHESTRATION_EVENTS } from "./events.js";

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
  createActiveTasksProvider,
  createConversationProvider,
  createKnowledgeProvider,
  createMemoryProvider,
  createPreferencesProvider,
  createProjectProvider,
  createSystemStateProvider,
  getDefaultContextManager,
  InMemoryActiveTaskStore,
  InMemoryConversationStore,
  InMemoryPreferenceStore,
  loadContext,
  setDefaultContextManager,
  summarizeConversation,
  type ActiveTaskStore,
  type ContextManagerOptions,
  type ContextProvider,
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

export { generateResponse } from "./stages/respond.js";

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
  StepResult,
  StepStatus,
  SystemStateInfo,
  UserPreferences,
} from "./types.js";
