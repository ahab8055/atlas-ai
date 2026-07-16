/**
 * AI runtime monitoring types (Architecture/15, Architecture/25 Model Health).
 */
import type {
  ModelRuntimePhase,
  RuntimeMemoryState,
} from "../model-runtime/types.js";

export type AiRuntimeMetricKind = "load" | "inference" | "error" | "status";

export interface AiRuntimeMetricEventBase {
  id: string;
  kind: AiRuntimeMetricKind;
  at: string;
  modelId?: string;
  provider?: string;
  message?: string;
}

export interface AiRuntimeLoadEvent extends AiRuntimeMetricEventBase {
  kind: "load";
  ok: boolean;
  durationMs: number;
  estimatedMemoryBytes?: number;
}

export interface AiRuntimeInferenceEvent extends AiRuntimeMetricEventBase {
  kind: "inference";
  ok: boolean;
  durationMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AiRuntimeErrorEvent extends AiRuntimeMetricEventBase {
  kind: "error";
  code?: string;
  operation: "load" | "generate" | "stream" | "other";
}

export interface AiRuntimeStatusEvent extends AiRuntimeMetricEventBase {
  kind: "status";
  phase: ModelRuntimePhase;
  memory: RuntimeMemoryState;
  activeModelId?: string;
}

export type AiRuntimeMetricEvent =
  | AiRuntimeLoadEvent
  | AiRuntimeInferenceEvent
  | AiRuntimeErrorEvent
  | AiRuntimeStatusEvent;

export interface TimingStats {
  count: number;
  totalMs: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
}

export interface AiRuntimeMetricsWarning {
  code: "slow_load" | "slow_inference" | "memory_over_budget";
  message: string;
  value?: number;
  threshold?: number;
}

export interface AiRuntimeMetrics {
  updatedAt: string;
  eventCount: number;
  load: TimingStats;
  loadFailures: number;
  inference: TimingStats;
  inferenceFailures: number;
  errorCount: number;
  lastErrors: AiRuntimeErrorEvent[];
  /** Latest status sample (phase + memory). */
  status?: {
    phase: ModelRuntimePhase;
    activeModelId?: string;
    memory: RuntimeMemoryState;
  };
  warnings: AiRuntimeMetricsWarning[];
}

export interface AiRuntimeMonitorOptions {
  /** Ring buffer capacity (default 100). */
  maxEvents?: number;
  now?: () => number;
  createEventId?: () => string;
  /** Override slow-load threshold ms (default 10_000). */
  slowLoadMs?: number;
  /** Override slow-inference threshold ms (default 30_000). */
  slowInferenceMs?: number;
}
