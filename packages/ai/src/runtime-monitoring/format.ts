/**
 * Format AI runtime metrics for CLI / logs.
 */
import { formatBytesShort } from "../model-runtime/memory.js";
import type {
  AiRuntimeMetricEvent,
  AiRuntimeMetrics,
  TimingStats,
} from "./types.js";

function formatTiming(
  label: string,
  stats: TimingStats,
  failures: number,
): string {
  if (stats.count === 0 && failures === 0) {
    return `${label}: (none)`;
  }
  const parts = [
    `${label}: n=${stats.count}`,
    `avg=${Math.round(stats.avgMs)}ms`,
    `min=${Math.round(stats.minMs)}ms`,
    `max=${Math.round(stats.maxMs)}ms`,
  ];
  if (failures > 0) {
    parts.push(`failures=${failures}`);
  }
  return parts.join(" ");
}

export function formatAiRuntimeMetrics(metrics: AiRuntimeMetrics): string {
  const lines = [
    "AI runtime metrics",
    `Events: ${metrics.eventCount}`,
    formatTiming("Load", metrics.load, metrics.loadFailures),
    formatTiming("Inference", metrics.inference, metrics.inferenceFailures),
    `Errors: ${metrics.errorCount}`,
  ];

  if (metrics.status) {
    const mem = metrics.status.memory;
    lines.push(
      `Status: ${metrics.status.phase}` +
        (metrics.status.activeModelId
          ? ` model=${metrics.status.activeModelId}`
          : ""),
    );
    lines.push(
      `Memory: ${formatBytesShort(mem.estimatedUsedBytes)} used` +
        (mem.budgetBytes !== undefined
          ? ` / ${formatBytesShort(mem.budgetBytes)} budget` +
            (mem.withinBudget ? " (ok)" : " (OVER)")
          : ""),
    );
  } else {
    lines.push("Status: (no sample yet)");
  }

  if (metrics.warnings.length > 0) {
    lines.push("Warnings:");
    for (const w of metrics.warnings) {
      lines.push(`  - [${w.code}] ${w.message}`);
    }
  } else {
    lines.push("Warnings: (none)");
  }

  if (metrics.lastErrors.length > 0) {
    lines.push("Recent errors:");
    for (const e of metrics.lastErrors.slice(-5)) {
      lines.push(
        `  - ${e.at} ${e.operation}${e.code ? ` [${e.code}]` : ""}: ${e.message ?? ""}`,
      );
    }
  }

  return lines.join("\n");
}

export function formatAiRuntimeMetricEvent(
  event: AiRuntimeMetricEvent,
): string {
  switch (event.kind) {
    case "load":
      return `${event.at} load ${event.ok ? "ok" : "FAIL"} ${event.modelId ?? "?"} ${Math.round(event.durationMs)}ms`;
    case "inference":
      return `${event.at} inference ${event.ok ? "ok" : "FAIL"} ${event.modelId ?? "?"} ${Math.round(event.durationMs)}ms`;
    case "error":
      return `${event.at} error ${event.operation}${event.code ? ` [${event.code}]` : ""}: ${event.message ?? ""}`;
    case "status":
      return `${event.at} status ${event.phase} mem=${formatBytesShort(event.memory.estimatedUsedBytes)}`;
    default:
      return `${(event as AiRuntimeMetricEvent).at} ${(event as AiRuntimeMetricEvent).kind}`;
  }
}

export function formatAiRuntimeRecentEvents(
  events: AiRuntimeMetricEvent[],
): string {
  if (events.length === 0) {
    return "No recent AI metric events.";
  }
  return [
    "Recent AI metric events:",
    ...events.map(formatAiRuntimeMetricEvent),
  ].join("\n");
}
