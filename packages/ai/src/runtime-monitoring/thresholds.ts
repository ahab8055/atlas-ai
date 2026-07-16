/**
 * Diagnosis thresholds for AI runtime metrics (Architecture/25 targets).
 */
import type {
  AiRuntimeMetrics,
  AiRuntimeMetricsWarning,
  AiRuntimeMonitorOptions,
} from "./types.js";

/** Architecture/25 model loading target: under 10 seconds. */
export const DEFAULT_SLOW_LOAD_MS = 10_000;

/** Soft inference latency flag for local diagnosis (not a hard SLA). */
export const DEFAULT_SLOW_INFERENCE_MS = 30_000;

export function resolveThresholds(options: AiRuntimeMonitorOptions = {}): {
  slowLoadMs: number;
  slowInferenceMs: number;
} {
  return {
    slowLoadMs: options.slowLoadMs ?? DEFAULT_SLOW_LOAD_MS,
    slowInferenceMs: options.slowInferenceMs ?? DEFAULT_SLOW_INFERENCE_MS,
  };
}

export function buildMetricWarnings(
  metrics: Omit<AiRuntimeMetrics, "warnings">,
  thresholds: { slowLoadMs: number; slowInferenceMs: number },
): AiRuntimeMetricsWarning[] {
  const warnings: AiRuntimeMetricsWarning[] = [];

  if (metrics.load.count > 0 && metrics.load.maxMs >= thresholds.slowLoadMs) {
    warnings.push({
      code: "slow_load",
      message: `Model load reached ${Math.round(metrics.load.maxMs)}ms (target <${thresholds.slowLoadMs}ms)`,
      value: metrics.load.maxMs,
      threshold: thresholds.slowLoadMs,
    });
  }

  if (
    metrics.inference.count > 0 &&
    metrics.inference.maxMs >= thresholds.slowInferenceMs
  ) {
    warnings.push({
      code: "slow_inference",
      message: `Inference reached ${Math.round(metrics.inference.maxMs)}ms (warn >=${thresholds.slowInferenceMs}ms)`,
      value: metrics.inference.maxMs,
      threshold: thresholds.slowInferenceMs,
    });
  }

  const memory = metrics.status?.memory;
  if (memory && !memory.withinBudget) {
    warnings.push({
      code: "memory_over_budget",
      message:
        `Estimated model memory over soft budget (${memory.estimatedUsedBytes} used` +
        (memory.budgetBytes !== undefined
          ? ` / ${memory.budgetBytes} budget)`
          : ")"),
      value: memory.estimatedUsedBytes,
      threshold: memory.budgetBytes,
    });
  }

  return warnings;
}
