import type {
  ExecutionLifecycleState,
  ExecutionResult,
  ExecutionStatus,
} from "../execution/types.js";
import type { DetectedIntent } from "../intent/types.js";
import type { ExecutionPlan } from "../planning/types.js";
import type { NormalizedRequest } from "../types.js";

/** How the response should be presented (adapters pick fields). */
export type ResponseModality = "text" | "voice" | "both";

/**
 * User-facing response after execution (Architecture/22 Response Generator).
 * `spokenText` is voice-ready for future TTS (Architecture/08) — not synthesized yet.
 */
export interface PipelineResponse {
  /** Full message for CLI / desktop / logs. */
  text: string;
  /** Concise speakable form for future TTS. */
  spokenText: string;
  /** One-line outcome headline. */
  summary: string;
  intent: string;
  /** Task / execution outcome status. */
  status: ExecutionStatus;
  /** Lifecycle state when available. */
  lifecycle?: ExecutionLifecycleState;
  /** Clear explanations of failures. */
  errors: string[];
  /** Non-fatal issues (skipped steps, partial work, etc.). */
  warnings: string[];
  /** Suggested next actions for the user. */
  nextSteps: string[];
  /** Suggested presentation modality from request source. */
  modality: ResponseModality;
}

export interface GenerateResponseInput {
  request: NormalizedRequest;
  intent: DetectedIntent;
  execution: ExecutionResult;
  plan?: ExecutionPlan;
}

export interface ResponseGeneratorOptions {
  /** Override modality (defaults from request.source). */
  modality?: ResponseModality;
}
