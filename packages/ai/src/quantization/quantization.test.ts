import { describe, expect, it } from "vitest";

import { RESOURCE_PROFILES } from "../hardware-detection/resource-profiles.js";
import type { DetectedHardware } from "../hardware-detection/types.js";
import { recommendModelsForProfile } from "../hardware-detection/recommend.js";
import {
  detectQuantization,
  formatQuantizationRecommendation,
  formatQuantizationTradeoffs,
  isQuantizedGguf,
  recommendQuantization,
  scoreQuantizationFit,
} from "./index.js";

function mockHardware(
  profileId: "low" | "balanced" | "performance",
): DetectedHardware {
  const profile = RESOURCE_PROFILES[profileId];
  return {
    detectedAt: new Date().toISOString(),
    os: { platform: "darwin", type: "Darwin", release: "1", arch: "arm64" },
    cpu: {
      model: "Mock",
      cores: 8,
      logicalProcessors: 8,
      arch: "arm64",
    },
    memory: {
      totalBytes: profileId === "low" ? 8 * 1024 ** 3 : 16 * 1024 ** 3,
      freeBytes: 4 * 1024 ** 3,
      totalGb: profileId === "low" ? 8 : 16,
      freeGb: 4,
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

describe("detectQuantization", () => {
  it("identifies common GGUF quant tags from filenames", () => {
    const q4 = detectQuantization("general/phi-3-mini-Q4_K_M.gguf");
    expect(q4.level).toBe("Q4_K_M");
    expect(q4.family).toBe("medium");
    expect(q4.quantized).toBe(true);
    expect(isQuantizedGguf("model-Q5_K_M.gguf")).toBe(true);

    const f16 = detectQuantization("llama-F16.gguf");
    expect(f16.level).toBe("F16");
    expect(f16.quantized).toBe(false);
  });

  it("accepts explicit overrides", () => {
    const info = detectQuantization("mystery.gguf", "Q8_0");
    expect(info.level).toBe("Q8_0");
    expect(info.source).toBe("explicit");
  });
});

describe("recommendQuantization", () => {
  it("recommends Q4 family for low-resource hosts", () => {
    const rec = recommendQuantization({
      hardware: mockHardware("low"),
    });
    expect(rec.preferredLevels[0]).toMatch(/^Q4/);
    expect(rec.acceptableFamilies).toContain("medium");
    expect(formatQuantizationRecommendation(rec)).toContain("Preferred levels");
    expect(formatQuantizationTradeoffs(["medium"])).toContain("Q4_K_M");
  });

  it("scores preferred quants higher for model recommendations", () => {
    const hardware = mockHardware("low");
    const rec = recommendQuantization({ hardware });
    const q4 = scoreQuantizationFit(detectQuantization("x-Q4_K_M.gguf"), rec);
    const f16 = scoreQuantizationFit(detectQuantization("x-F16.gguf"), rec);
    expect(q4.score).toBeGreaterThan(f16.score);

    const ranked = recommendModelsForProfile(
      [
        {
          id: "big-F16.gguf",
          sizeBytes: 2 * 1024 ** 3,
          capabilities: ["chat"],
          status: "available",
          requirements: { minRamGb: 4, acceleration: "cpu" },
        },
        {
          id: "small-Q4_K_M.gguf",
          sizeBytes: 2 * 1024 ** 3,
          capabilities: ["chat", "quantized"],
          status: "available",
          quantization: "Q4_K_M",
          requirements: {
            minRamGb: 4,
            acceleration: "cpu",
            quantization: "Q4_K_M",
          },
        },
      ],
      { hardware },
    );
    expect(ranked[0]?.model.id).toContain("Q4_K_M");
    expect(ranked[0]?.quantization).toBe("Q4_K_M");
  });
});
