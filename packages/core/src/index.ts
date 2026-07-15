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

export { loadContext } from "./stages/context.js";
export { createPlan } from "./stages/plan.js";
export { executePlan } from "./stages/execute.js";
export { generateResponse } from "./stages/respond.js";

export type {
  DetectedIntent,
  ExecutionPlan,
  ExecutionResult,
  ExecutionStatus,
  IncomingRequest,
  InputSource,
  IntentCategory,
  IntentComplexity,
  IntentParameters,
  LoadedContext,
  NormalizedRequest,
  PipelineResponse,
  PipelineResult,
  PipelineStageName,
  PlanStep,
  StepResult,
  StepStatus,
} from "./types.js";
