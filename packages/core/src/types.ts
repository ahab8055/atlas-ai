import type { InputSource } from "./sources.js";

export type { InputSource } from "./sources.js";

/** Raw input from any adapter before normalization. */
export interface IncomingRequest {
  source: InputSource;
  rawInput: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

/** Canonical request shape after normalization. */
export interface NormalizedRequest {
  id: string;
  traceId: string;
  source: InputSource;
  text: string;
  sessionId: string;
  receivedAt: string;
  metadata: Record<string, unknown>;
}

export type PipelineStageName =
  "normalize" | "intent" | "context" | "planning" | "execution" | "response";

export type {
  DetectedIntent,
  IntentCategory,
  IntentComplexity,
  IntentParameters,
} from "./intent/types.js";

export type {
  ActiveTask,
  ContextSourceId,
  ConversationContext,
  ConversationTurn,
  KnowledgeSnippet,
  LoadedContext,
  MemorySnippet,
  ProjectContext,
  SystemStateInfo,
  UserPreferences,
} from "./context/types.js";

export type { ExecutionPlan, PlanKind, PlanStep } from "./planning/types.js";

export type {
  ExecutionFailure,
  ExecutionLifecycleState,
  ExecutionProgress,
  ExecutionResult,
  ExecutionStatus,
  ExecutionTask,
  StepResult,
  StepStatus,
} from "./execution/types.js";

import type { DetectedIntent } from "./intent/types.js";
import type { LoadedContext } from "./context/types.js";
import type { ExecutionPlan } from "./planning/types.js";
import type { ExecutionResult } from "./execution/types.js";
import type { PipelineResponse } from "./response/types.js";

export type {
  PipelineResponse,
  ResponseModality,
  GenerateResponseInput,
  ResponseGeneratorOptions,
} from "./response/types.js";

export interface PipelineResult {
  request: NormalizedRequest;
  intent: DetectedIntent;
  context: LoadedContext;
  plan: ExecutionPlan;
  execution: ExecutionResult;
  response: PipelineResponse;
}
