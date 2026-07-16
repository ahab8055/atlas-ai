import { describe, expect, it } from "vitest";

import { RESOURCE_PROFILES } from "../hardware-detection/resource-profiles.js";
import type { DetectedHardware } from "../hardware-detection/types.js";
import type { RegisteredModel } from "../model-registry/types.js";
import { analyzeTask } from "./analyze.js";
import { formatRoutingDecision, routeModel } from "./router.js";

function mockHardware(
  profileId: "low" | "balanced" | "performance" = "balanced",
): DetectedHardware {
  const profile = RESOURCE_PROFILES[profileId];
  return {
    detectedAt: new Date().toISOString(),
    os: { platform: "darwin", type: "Darwin", release: "1", arch: "arm64" },
    cpu: {
      model: "Mock CPU",
      cores: 8,
      logicalProcessors: 8,
      arch: "arm64",
    },
    memory: {
      totalBytes: 16 * 1024 ** 3,
      freeBytes: 8 * 1024 ** 3,
      totalGb: 16,
      freeGb: 8,
    },
    gpus: [],
    gpuAvailable: false,
    profileId,
    tier: profileId,
    profile,
    inferenceProfile: profile.defaultInference,
    notes: [],
  };
}

function model(
  id: string,
  overrides: Partial<RegisteredModel> = {},
): RegisteredModel {
  const now = new Date().toISOString();
  return {
    id,
    name: id,
    version: "1",
    format: "gguf",
    sizeBytes: overrides.sizeBytes,
    capabilities: overrides.capabilities ?? ["chat", "local"],
    requirements: overrides.requirements ?? {
      minRamGb: 4,
      acceleration: "cpu",
    },
    provider: "llamacpp",
    status: overrides.status ?? "available",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("analyzeTask", () => {
  it("classifies simple conversation", () => {
    const task = analyzeTask({ prompt: "hello there" });
    expect(task.taskType).toBe("conversation");
    expect(task.complexity).toBe("simple");
  });

  it("classifies coding tasks", () => {
    const task = analyzeTask({
      prompt: "Refactor this TypeScript function to use async/await",
    });
    expect(task.taskType).toBe("coding");
    expect(["moderate", "complex"]).toContain(task.complexity);
  });

  it("classifies architecture reasoning", () => {
    const task = analyzeTask({
      prompt: "Review my backend architecture and trade-offs for scaling",
    });
    expect(task.taskType).toBe("reasoning");
    expect(task.complexity).toBe("complex");
  });
});

describe("routeModel", () => {
  const catalog: RegisteredModel[] = [
    model("general/tiny.gguf", {
      sizeBytes: 400 * 1024 ** 2,
      capabilities: ["chat", "local"],
    }),
    model("coding/medium.gguf", {
      sizeBytes: 4 * 1024 ** 3,
      capabilities: ["coding", "chat", "local"],
    }),
    model("general/large-reason.gguf", {
      sizeBytes: 12 * 1024 ** 3,
      capabilities: ["reasoning", "chat", "local"],
    }),
  ];

  it("routes simple chat to a small model", () => {
    const decision = routeModel({
      prompt: "hi",
      models: catalog,
      hardware: mockHardware("balanced"),
    });
    expect(decision.routed).toBe(true);
    expect(decision.mode).toBe("auto");
    expect(decision.modelId).toBe("general/tiny.gguf");
    expect(decision.reasons.length).toBeGreaterThan(2);
    expect(formatRoutingDecision(decision)).toContain("Selected model");
  });

  it("routes coding tasks toward coding-capable models", () => {
    const decision = routeModel({
      prompt: "Implement a REST API in Rust with unit tests",
      models: catalog,
      hardware: mockHardware("performance"),
    });
    expect(decision.task.taskType).toBe("coding");
    expect(decision.modelId).toMatch(/coding/);
  });

  it("supports manual model override", () => {
    const decision = routeModel({
      prompt: "hello",
      models: catalog,
      preferredModelId: "general/large-reason.gguf",
      hardware: mockHardware(),
    });
    expect(decision.mode).toBe("manual");
    expect(decision.modelId).toBe("general/large-reason.gguf");
    expect(decision.reasons.some((r) => r.includes("manual selection"))).toBe(
      true,
    );
  });

  it("falls back when catalog is empty", () => {
    const decision = routeModel({
      prompt: "hello",
      models: [],
      fallbackModelId: "mock-default",
      hardware: mockHardware(),
    });
    expect(decision.modelId).toBe("mock-default");
    expect(decision.reasons.some((r) => r.includes("fallback"))).toBe(true);
  });
});
