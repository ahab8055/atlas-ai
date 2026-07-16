import { describe, expect, it } from "vitest";

import { RESOURCE_PROFILES } from "../hardware-detection/resource-profiles.js";
import type { DetectedHardware } from "../hardware-detection/types.js";
import {
  assertModelCompatible,
  checkModelCompatibility,
  formatCompatibilityReport,
} from "./checker.js";
import { AiRuntimeError } from "../errors.js";
import { createAiRuntime } from "../runtime.js";

function mockHardware(
  overrides: Partial<DetectedHardware> = {},
): DetectedHardware {
  return {
    detectedAt: new Date().toISOString(),
    os: { platform: "linux", type: "Linux", release: "1", arch: "x64" },
    cpu: {
      model: "Mock CPU",
      cores: 4,
      logicalProcessors: 4,
      arch: "x64",
    },
    memory: {
      totalBytes: 8 * 1024 ** 3,
      freeBytes: 4 * 1024 ** 3,
      totalGb: 8,
      freeGb: 4,
    },
    gpus: [],
    gpuAvailable: false,
    profileId: "low",
    tier: "low",
    profile: RESOURCE_PROFILES.low,
    inferenceProfile: {
      acceleration: "cpu",
      gpuLayers: 0,
      contextSize: 2048,
    },
    notes: [],
    ...overrides,
  };
}

describe("model compatibility checker", () => {
  it("identifies unsupported models for RAM/GPU/CPU at runtime", () => {
    const result = checkModelCompatibility({
      modelId: "huge-gpu",
      mode: "runtime",
      hardware: mockHardware(),
      requirements: {
        minRamGb: 64,
        minLogicalProcessors: 16,
        acceleration: "gpu",
        requireGpu: true,
      },
      sizeBytes: 1024,
    });

    expect(result.compatible).toBe(false);
    expect(result.supported).toBe(false);
    expect(result.checks.ram.ok).toBe(false);
    expect(result.checks.cpu.ok).toBe(false);
    expect(result.checks.gpu.ok).toBe(false);
    expect(result.issues.some((i) => i.code === "ram_insufficient")).toBe(true);
    expect(result.issues.some((i) => i.code === "gpu_required")).toBe(true);
    expect(formatCompatibilityReport(result)).toContain("UNSUPPORTED");
  });

  it("passes compatible small CPU models", () => {
    const result = checkModelCompatibility({
      modelId: "tiny",
      mode: "runtime",
      hardware: mockHardware(),
      requirements: { minRamGb: 4, acceleration: "cpu" },
      sizeBytes: 1024,
    });
    expect(result.compatible).toBe(true);
    expect(result.checks.ram.ok).toBe(true);
    expect(result.summary).toMatch(/Compatible/);
  });

  it("treats GPU preference as warning on install but error at runtime", () => {
    const install = checkModelCompatibility({
      mode: "install",
      hardware: mockHardware(),
      requirements: { acceleration: "gpu" },
    });
    expect(install.compatible).toBe(true);
    expect(install.issues.some((i) => i.severity === "warning")).toBe(true);

    const runtime = checkModelCompatibility({
      mode: "runtime",
      hardware: mockHardware(),
      requirements: { acceleration: "gpu" },
    });
    expect(runtime.compatible).toBe(false);
  });

  it("assertModelCompatible throws and blocks execution path", () => {
    expect(() =>
      assertModelCompatible({
        hardware: mockHardware(),
        requirements: { minRamGb: 128 },
      }),
    ).toThrow(AiRuntimeError);
  });

  it("AiRuntime.loadModel refuses incompatible models when gate enabled", async () => {
    const runtime = createAiRuntime({
      provider: "mock",
      defaultModelId: "needs-ram",
      compatibility: {
        enabled: true,
        skipGpuProbe: true,
        resolve: () => ({
          requirements: { minRamGb: 10_000 },
        }),
      },
    });

    await expect(runtime.loadModel()).rejects.toMatchObject({
      code: "model_incompatible",
    });
  });
});
