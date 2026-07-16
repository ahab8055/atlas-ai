import { describe, expect, it } from "vitest";

import { createAiRuntime } from "../runtime.js";
import {
  DEFAULT_SLOW_INFERENCE_MS,
  DEFAULT_SLOW_LOAD_MS,
  createAiRuntimeMonitor,
  formatAiRuntimeMetrics,
  formatAiRuntimeRecentEvents,
} from "./index.js";

describe("AiRuntimeMonitor", () => {
  it("aggregates load and inference timings in a ring buffer", () => {
    const monitor = createAiRuntimeMonitor({ maxEvents: 3 });
    monitor.recordLoad({
      modelId: "a",
      ok: true,
      durationMs: 100,
    });
    monitor.recordInference({
      modelId: "a",
      ok: true,
      durationMs: 50,
      totalTokens: 10,
    });
    monitor.recordInference({
      modelId: "a",
      ok: true,
      durationMs: 150,
    });
    monitor.recordError({
      operation: "generate",
      message: "boom",
      code: "ai_error",
    });

    const metrics = monitor.getMetrics();
    expect(metrics.load.count).toBe(1);
    expect(metrics.load.avgMs).toBe(100);
    expect(metrics.inference.count).toBe(2);
    expect(metrics.inference.minMs).toBe(50);
    expect(metrics.inference.maxMs).toBe(150);
    expect(metrics.errorCount).toBe(1);
    expect(metrics.lastErrors[0]?.message).toBe("boom");
    // ring buffer keeps last 3 events (2 inferences + 1 error)
    expect(monitor.getRecentEvents(10)).toHaveLength(3);
  });

  it("emits slow_load and memory_over_budget warnings", () => {
    const monitor = createAiRuntimeMonitor({
      slowLoadMs: 100,
      slowInferenceMs: 200,
    });
    monitor.recordLoad({ modelId: "big", ok: true, durationMs: 500 });
    monitor.recordStatus({
      phase: "ready",
      loaded: [],
      sessions: [],
      memory: {
        estimatedUsedBytes: 9,
        budgetBytes: 8,
        withinBudget: false,
      },
      idleUnloadMs: 0,
      maxLoadedModels: 1,
      updatedAt: new Date().toISOString(),
    });

    const metrics = monitor.getMetrics();
    expect(metrics.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining(["slow_load", "memory_over_budget"]),
    );
    expect(DEFAULT_SLOW_LOAD_MS).toBe(10_000);
    expect(DEFAULT_SLOW_INFERENCE_MS).toBe(30_000);
  });

  it("formats metrics and recent events for CLI", () => {
    const monitor = createAiRuntimeMonitor();
    monitor.recordLoad({ modelId: "m", ok: true, durationMs: 12 });
    const text = formatAiRuntimeMetrics(monitor.getMetrics());
    expect(text).toContain("AI runtime metrics");
    expect(text).toContain("Load:");
    expect(formatAiRuntimeRecentEvents(monitor.getRecentEvents())).toContain(
      "load ok",
    );
  });
});

describe("AiRuntime metrics integration", () => {
  it("records load and inference via createAiRuntime", async () => {
    const runtime = createAiRuntime({
      provider: "mock",
      defaultModelId: "mock-general",
    });

    await runtime.loadModel();
    const result = await runtime.generate({
      messages: [{ role: "user", content: "hi" }],
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);

    const metrics = runtime.getMetrics();
    expect(metrics.load.count).toBeGreaterThanOrEqual(1);
    expect(metrics.inference.count).toBeGreaterThanOrEqual(1);
    expect(metrics.status?.phase).toBeDefined();
    expect(runtime.getRecentMetricEvents(5).length).toBeGreaterThan(0);
  });
});
