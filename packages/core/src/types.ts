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

import type { DetectedIntent } from "./intent/types.js";
import type { LoadedContext } from "./context/types.js";

export interface PlanStep {
  id: string;
  description: string;
  /** Optional tool name for execution stage. */
  tool?: string;
  args?: Record<string, unknown>;
  /** Security capability when a tool may touch the system. */
  capability?: string;
}

export interface ExecutionPlan {
  steps: PlanStep[];
  requiresApproval: boolean;
}

export type StepStatus = "completed" | "skipped" | "blocked" | "failed";

export interface StepResult {
  stepId: string;
  status: StepStatus;
  output?: string;
  error?: string;
}

export type ExecutionStatus = "completed" | "partial" | "blocked" | "failed";

export interface ExecutionResult {
  status: ExecutionStatus;
  steps: StepResult[];
}

export interface PipelineResponse {
  text: string;
  intent: string;
  status: ExecutionStatus;
}

export interface PipelineResult {
  request: NormalizedRequest;
  intent: DetectedIntent;
  context: LoadedContext;
  plan: ExecutionPlan;
  execution: ExecutionResult;
  response: PipelineResponse;
}
