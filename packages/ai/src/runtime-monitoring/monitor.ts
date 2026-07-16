/**
 * In-process AI runtime metrics collector (Architecture/15 basic metrics).
 */
import type { ModelRuntimeSnapshot } from "../model-runtime/types.js";
import { buildMetricWarnings, resolveThresholds } from "./thresholds.js";
import type {
  AiRuntimeErrorEvent,
  AiRuntimeInferenceEvent,
  AiRuntimeLoadEvent,
  AiRuntimeMetricEvent,
  AiRuntimeMetrics,
  AiRuntimeMonitorOptions,
  AiRuntimeStatusEvent,
  TimingStats,
} from "./types.js";

const DEFAULT_MAX_EVENTS = 100;

function emptyTiming(): TimingStats {
  return { count: 0, totalMs: 0, avgMs: 0, minMs: 0, maxMs: 0 };
}

function pushTiming(stats: TimingStats, durationMs: number): TimingStats {
  const ms = Math.max(0, durationMs);
  const count = stats.count + 1;
  const totalMs = stats.totalMs + ms;
  return {
    count,
    totalMs,
    avgMs: totalMs / count,
    minMs: stats.count === 0 ? ms : Math.min(stats.minMs, ms),
    maxMs: stats.count === 0 ? ms : Math.max(stats.maxMs, ms),
  };
}

export class AiRuntimeMonitor {
  private readonly maxEvents: number;
  private readonly now: () => number;
  private readonly createEventId: () => string;
  private readonly thresholds: {
    slowLoadMs: number;
    slowInferenceMs: number;
  };
  private readonly events: AiRuntimeMetricEvent[] = [];
  private load = emptyTiming();
  private inference = emptyTiming();
  private loadFailures = 0;
  private inferenceFailures = 0;
  private errorCount = 0;
  private lastStatus?: AiRuntimeStatusEvent;

  constructor(options: AiRuntimeMonitorOptions = {}) {
    this.maxEvents = Math.max(
      1,
      Math.floor(options.maxEvents ?? DEFAULT_MAX_EVENTS),
    );
    this.now = options.now ?? (() => Date.now());
    this.createEventId =
      options.createEventId ??
      (() =>
        `m_${this.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`);
    this.thresholds = resolveThresholds(options);
  }

  reset(): void {
    this.events.length = 0;
    this.load = emptyTiming();
    this.inference = emptyTiming();
    this.loadFailures = 0;
    this.inferenceFailures = 0;
    this.errorCount = 0;
    this.lastStatus = undefined;
  }

  recordLoad(input: {
    modelId: string;
    provider?: string;
    ok: boolean;
    durationMs: number;
    estimatedMemoryBytes?: number;
    message?: string;
  }): AiRuntimeLoadEvent {
    const event: AiRuntimeLoadEvent = {
      id: this.createEventId(),
      kind: "load",
      at: new Date(this.now()).toISOString(),
      modelId: input.modelId,
      provider: input.provider,
      ok: input.ok,
      durationMs: Math.max(0, input.durationMs),
      estimatedMemoryBytes: input.estimatedMemoryBytes,
      message: input.message,
    };
    this.push(event);
    if (input.ok) {
      this.load = pushTiming(this.load, event.durationMs);
    } else {
      this.loadFailures += 1;
    }
    return event;
  }

  recordInference(input: {
    modelId?: string;
    provider?: string;
    ok: boolean;
    durationMs: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    message?: string;
  }): AiRuntimeInferenceEvent {
    const event: AiRuntimeInferenceEvent = {
      id: this.createEventId(),
      kind: "inference",
      at: new Date(this.now()).toISOString(),
      modelId: input.modelId,
      provider: input.provider,
      ok: input.ok,
      durationMs: Math.max(0, input.durationMs),
      promptTokens: input.promptTokens,
      completionTokens: input.completionTokens,
      totalTokens: input.totalTokens,
      message: input.message,
    };
    this.push(event);
    if (input.ok) {
      this.inference = pushTiming(this.inference, event.durationMs);
    } else {
      this.inferenceFailures += 1;
    }
    return event;
  }

  recordError(input: {
    operation: AiRuntimeErrorEvent["operation"];
    message: string;
    modelId?: string;
    provider?: string;
    code?: string;
  }): AiRuntimeErrorEvent {
    const event: AiRuntimeErrorEvent = {
      id: this.createEventId(),
      kind: "error",
      at: new Date(this.now()).toISOString(),
      operation: input.operation,
      message: input.message,
      modelId: input.modelId,
      provider: input.provider,
      code: input.code,
    };
    this.push(event);
    this.errorCount += 1;
    return event;
  }

  recordStatus(snapshot: ModelRuntimeSnapshot): AiRuntimeStatusEvent {
    const event: AiRuntimeStatusEvent = {
      id: this.createEventId(),
      kind: "status",
      at: snapshot.updatedAt,
      phase: snapshot.phase,
      activeModelId: snapshot.activeModelId,
      memory: { ...snapshot.memory },
      modelId: snapshot.activeModelId,
    };
    this.push(event);
    this.lastStatus = event;
    return event;
  }

  getRecentEvents(limit = 20): AiRuntimeMetricEvent[] {
    const n = Math.max(0, Math.floor(limit));
    if (n === 0) {
      return [];
    }
    return this.events.slice(-n).map((e) => ({ ...e }));
  }

  getMetrics(): AiRuntimeMetrics {
    const lastErrors = this.events
      .filter((e): e is AiRuntimeErrorEvent => e.kind === "error")
      .slice(-10)
      .map((e) => ({ ...e }));

    const base: Omit<AiRuntimeMetrics, "warnings"> = {
      updatedAt: new Date(this.now()).toISOString(),
      eventCount: this.events.length,
      load: { ...this.load },
      loadFailures: this.loadFailures,
      inference: { ...this.inference },
      inferenceFailures: this.inferenceFailures,
      errorCount: this.errorCount,
      lastErrors,
      status: this.lastStatus
        ? {
            phase: this.lastStatus.phase,
            activeModelId: this.lastStatus.activeModelId,
            memory: { ...this.lastStatus.memory },
          }
        : undefined,
    };

    return {
      ...base,
      warnings: buildMetricWarnings(base, this.thresholds),
    };
  }

  private push(event: AiRuntimeMetricEvent): void {
    this.events.push(event);
    while (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }
}

export function createAiRuntimeMonitor(
  options?: AiRuntimeMonitorOptions,
): AiRuntimeMonitor {
  return new AiRuntimeMonitor(options);
}
