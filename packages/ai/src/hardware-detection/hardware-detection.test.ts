import os from "node:os";

import { describe, expect, it } from "vitest";

import { classifyResourceProfile, classifyHardwareTier } from "./classify.js";
import { detectHardware } from "./detect.js";
import type { SystemProbe } from "./probe.js";
import {
  evaluateModelSuitability,
  selectSuitableModels,
  suggestInferenceProfile,
} from "./profile.js";
import { recommendModelsForProfile } from "./recommend.js";
import {
  listResourceProfiles,
  RESOURCE_PROFILES,
} from "./resource-profiles.js";
import type { DetectedGpu } from "./types.js";

function mockProbe(
  overrides: Partial<{
    platform: NodeJS.Platform;
    arch: string;
    cpus: os.CpuInfo[];
    totalmem: number;
    freemem: number;
    commands: Record<string, { stdout: string; status: number }>;
  }> = {},
): SystemProbe {
  const cpus =
    overrides.cpus ??
    Array.from({ length: 4 }, () => ({
      model: "Mock CPU",
      speed: 2400,
      times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 },
    }));

  return {
    platform: () => overrides.platform ?? "linux",
    arch: () => overrides.arch ?? "x64",
    cpus: () => cpus,
    totalmem: () => overrides.totalmem ?? 16 * 1024 ** 3,
    freemem: () => overrides.freemem ?? 8 * 1024 ** 3,
    release: () => "1.0.0",
    type: () => "Linux",
    version: () => "Mock OS",
    runCommand(command, args) {
      const key = [command, ...args].join(" ");
      const hit = overrides.commands?.[key] ?? overrides.commands?.[command];
      if (!hit) {
        return null;
      }
      return { stdout: hit.stdout, stderr: "", status: hit.status };
    },
  };
}

describe("hardware detection", () => {
  it("collects CPU, RAM, and OS information", () => {
    const hardware = detectHardware({
      probe: mockProbe({
        totalmem: 24 * 1024 ** 3,
        freemem: 10 * 1024 ** 3,
        cpus: Array.from({ length: 8 }, () => ({
          model: "Apple M3",
          speed: 0,
          times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 },
        })),
        platform: "darwin",
        arch: "arm64",
      }),
      skipGpuProbe: true,
    });

    expect(hardware.cpu.model).toBe("Apple M3");
    expect(hardware.cpu.logicalProcessors).toBe(8);
    expect(hardware.memory.totalGb).toBe(24);
    expect(hardware.os.platform).toBe("darwin");
    expect(hardware.gpuAvailable).toBe(true);
    expect(hardware.gpus[0]?.vendor).toBe("Apple");
    expect(hardware.profileId).toBe("balanced");
    expect(hardware.tier).toBe("balanced");
    expect(hardware.profile.label).toBe("Balanced");
    expect(hardware.inferenceProfile.acceleration).toBe("gpu");
    expect(hardware.inferenceProfile.gpuLayers).toBeGreaterThan(0);
  });

  it("parses NVIDIA VRAM from nvidia-smi", () => {
    const hardware = detectHardware({
      probe: mockProbe({
        totalmem: 64 * 1024 ** 3,
        commands: {
          "nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits":
            {
              stdout: "NVIDIA GeForce RTX 4090, 24564\n",
              status: 0,
            },
        },
      }),
    });

    expect(hardware.gpuAvailable).toBe(true);
    expect(hardware.gpus[0]?.name).toContain("4090");
    expect(hardware.gpus[0]?.vramGb).toBeGreaterThan(20);
    expect(hardware.gpus[0]?.integrated).toBe(false);
    expect(hardware.profileId).toBe("performance");
    expect(hardware.inferenceProfile.acceleration).toBe("gpu");
  });

  it("classifies low-resource hosts as low profile with CPU inference", () => {
    expect(classifyResourceProfile({ totalRamGb: 8, gpus: [] })).toBe("low");
    expect(classifyHardwareTier({ totalRamGb: 8, gpus: [] })).toBe("low");

    const hardware = detectHardware({
      probe: mockProbe({ totalmem: 8 * 1024 ** 3 }),
      skipGpuProbe: true,
      preferCpu: true,
    });
    expect(hardware.profileId).toBe("low");
    expect(hardware.inferenceProfile.acceleration).toBe("cpu");
    expect(hardware.inferenceProfile.gpuLayers).toBe(0);
  });

  it("defines low, balanced, and performance resource profiles", () => {
    const profiles = listResourceProfiles();
    expect(profiles.map((p) => p.id)).toEqual([
      "low",
      "balanced",
      "performance",
    ]);
    expect(RESOURCE_PROFILES.low.modelGuidance.sizeClass).toBe("small");
    expect(RESOURCE_PROFILES.balanced.architectureName).toBe("Standard");
    expect(RESOURCE_PROFILES.performance.modelGuidance.sizeClass).toBe("large");
  });

  it("evaluates model suitability for selection logic", () => {
    const hardware = detectHardware({
      probe: mockProbe({ totalmem: 16 * 1024 ** 3 }),
      skipGpuProbe: true,
      preferCpu: true,
    });

    const ok = evaluateModelSuitability(
      { minRamGb: 8, acceleration: "cpu" },
      hardware,
    );
    expect(ok.suitable).toBe(true);

    const tooBig = evaluateModelSuitability(
      { minRamGb: 64, acceleration: "gpu" },
      hardware,
    );
    expect(tooBig.suitable).toBe(false);
    expect(tooBig.reasons.length).toBeGreaterThan(0);

    const selected = selectSuitableModels(
      [
        { id: "small", requirements: { minRamGb: 4 } },
        { id: "huge", requirements: { minRamGb: 128 } },
      ],
      hardware,
    );
    expect(selected.map((m) => m.id)).toEqual(["small"]);
  });

  it("recommends models for the active hardware profile", () => {
    const hardware = detectHardware({
      probe: mockProbe({ totalmem: 16 * 1024 ** 3 }),
      skipGpuProbe: true,
      preferCpu: true,
    });

    const recommendations = recommendModelsForProfile(
      [
        {
          id: "tiny",
          sizeBytes: 1.5 * 1024 ** 3,
          capabilities: ["chat", "local"],
          requirements: { minRamGb: 4, acceleration: "cpu" },
          status: "available",
        },
        {
          id: "huge",
          sizeBytes: 30 * 1024 ** 3,
          capabilities: ["chat"],
          requirements: { minRamGb: 48, acceleration: "gpu" },
          status: "available",
        },
        {
          id: "mid",
          sizeBytes: 6 * 1024 ** 3,
          capabilities: ["chat", "coding"],
          requirements: { minRamGb: 12 },
          status: "available",
        },
      ],
      { hardware, limit: 5 },
    );

    expect(recommendations.length).toBeGreaterThan(0);
    expect(recommendations[0]?.profileId).toBe(hardware.profileId);
    expect(recommendations.map((r) => r.model.id)).toContain("tiny");
    expect(recommendations.map((r) => r.model.id)).not.toContain("huge");
  });

  it("suggests GPU layers from VRAM", () => {
    const gpus: DetectedGpu[] = [
      {
        name: "GPU",
        available: true,
        integrated: false,
        vramGb: 8,
        vramBytes: 8 * 1024 ** 3,
      },
    ];
    const profile = suggestInferenceProfile({
      cpuLogicalProcessors: 12,
      gpus,
      profileId: "balanced",
    });
    expect(profile.acceleration).toBe("gpu");
    expect(profile.gpuLayers).toBe(40);
    expect(profile.threads).toBe(12);
  });
});
