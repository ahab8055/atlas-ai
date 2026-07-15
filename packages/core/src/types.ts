/**
 * Request sources. CLI is first; desktop and voice reuse the same pipeline.
 */
export type InputSource = "cli" | "desktop" | "voice" | "api";

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

export type IntentComplexity = "low" | "medium" | "high";

export interface DetectedIntent {
  name: string;
  confidence: number;
  capabilities: string[];
  complexity: IntentComplexity;
}

export interface LoadedContext {
  conversationSummary: string;
  memories: string[];
  systemState: {
    runtime: string;
    source: InputSource;
  };
}

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
