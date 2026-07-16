/**
 * Model Runtime Manager types (Architecture/25 AI Runtime Manager).
 */
import type { AiRuntimeMonitor } from "../runtime-monitoring/monitor.js";
import type { ModelInfo } from "../types.js";

/** Coarse runtime phase for the manager. */
export type ModelRuntimePhase =
  "idle" | "loading" | "ready" | "busy" | "unloading" | "error";

export interface LoadedModelState {
  modelId: string;
  model?: ModelInfo;
  status: ModelRuntimePhase;
  loadedAt: string;
  lastUsedAt: string;
  /** Duration of the most recent successful load in ms. */
  lastLoadDurationMs?: number;
  /** Estimated resident weight size when known. */
  estimatedMemoryBytes?: number;
  /** Open inference sessions using this model. */
  sessionCount: number;
  lastError?: string;
}

export type InferenceSessionStatus = "open" | "closed";

export interface InferenceSession {
  id: string;
  modelId: string;
  status: InferenceSessionStatus;
  createdAt: string;
  lastUsedAt: string;
  /** Number of generate/stream calls attributed to this session. */
  inferenceCount: number;
}

export interface RuntimeMemoryState {
  /** Sum of estimatedMemoryBytes for loaded models. */
  estimatedUsedBytes: number;
  /** Optional budget (bytes). */
  budgetBytes?: number;
  withinBudget: boolean;
  /** Free host RAM snapshot when provided at construction/update. */
  hostFreeBytes?: number;
  hostTotalBytes?: number;
}

export interface ModelRuntimeSnapshot {
  phase: ModelRuntimePhase;
  activeModelId?: string;
  loaded: LoadedModelState[];
  sessions: InferenceSession[];
  memory: RuntimeMemoryState;
  /** Idle unload policy in ms (0 = disabled). */
  idleUnloadMs: number;
  maxLoadedModels: number;
  lastError?: string;
  updatedAt: string;
}

export interface ModelRuntimeManagerOptions {
  /** Max models kept loaded concurrently (default 1 — llama.cpp typical). */
  maxLoadedModels?: number;
  /**
   * Unload ready models with no open sessions after this idle period.
   * 0 disables automatic reclaim (default 5 minutes).
   */
  idleUnloadMs?: number;
  /** Soft memory budget for estimated model weights. */
  memoryBudgetBytes?: number;
  /** Optional host memory snapshot for reporting. */
  hostMemory?: { totalBytes: number; freeBytes: number };
  /** Resolve sizeBytes for memory accounting (registry / disk). */
  resolveSizeBytes?: (modelId: string) => number | undefined;
  /** Clock for tests. */
  now?: () => number;
  /** Id generator for sessions (tests). */
  createSessionId?: () => string;
  /** Optional metrics collector (Architecture/15 AI runtime monitoring). */
  monitor?: AiRuntimeMonitor;
}
