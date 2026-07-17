/**
 * Phase 2 Local AI Engine — integration tests.
 *
 * Cross-package workflows (mock provider, no live llama-server required):
 * load · inference · routing · hardware · offline · critical path.
 */
import { describe, expect, it } from "vitest";

import {
  AiRuntimeError,
  assessOfflineCapability,
  createModelInstaller,
  detectHardware,
  listResourceProfiles,
  recommendModelsForProfile,
} from "@atlas-ai/ai";

import { createLocalAiHarness, createRouterCatalog } from "./ai-helpers.js";

describe("Phase 2 integration — model loading", () => {
  it("loads mock-general and mock-coding, then unloads", async () => {
    const harness = createLocalAiHarness();
    try {
      const general = await harness.runtime.loadModel("mock-general");
      expect(general.id).toBe("mock-general");
      expect(general.status).toBe("loaded");
      expect(harness.runtime.getActiveModel()?.id).toBe("mock-general");

      const coding = await harness.runtime.loadModel("mock-coding");
      expect(coding.id).toBe("mock-coding");
      expect(harness.runtime.getActiveModel()?.id).toBe("mock-coding");

      await harness.runtime.unloadModel();
      expect(harness.runtime.getActiveModel()).toBeUndefined();
    } finally {
      harness.cleanup();
    }
  });

  it("rejects unknown model ids", async () => {
    const harness = createLocalAiHarness();
    try {
      await expect(
        harness.runtime.loadModel("does-not-exist"),
      ).rejects.toBeInstanceOf(AiRuntimeError);
    } finally {
      harness.cleanup();
    }
  });
});

describe("Phase 2 integration — inference execution", () => {
  it("generates and streams with mock provider and records metrics", async () => {
    const harness = createLocalAiHarness();
    try {
      await harness.runtime.loadModel("mock-general");
      const result = await harness.runtime.generate({
        messages: [{ role: "user", content: "phase2 hello" }],
      });
      expect(result.provider).toBe("mock");
      expect(result.modelId).toBe("mock-general");
      expect(result.text).toContain("phase2 hello");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      const chunks: string[] = [];
      let sawDone = false;
      for await (const chunk of harness.runtime.stream({
        messages: [{ role: "user", content: "stream me" }],
      })) {
        if (chunk.text) {
          chunks.push(chunk.text);
        }
        if (chunk.done) {
          sawDone = true;
        }
      }
      expect(sawDone).toBe(true);
      expect(chunks.join("")).toContain("stream me");

      const metrics = harness.runtime.getMetrics();
      expect(metrics.inference.count).toBeGreaterThanOrEqual(1);
      expect(metrics.load.count).toBeGreaterThanOrEqual(1);
    } finally {
      harness.cleanup();
    }
  });
});

describe("Phase 2 integration — model routing", () => {
  it("routes coding prompts toward coding-capable models", () => {
    const harness = createLocalAiHarness({
      routerCatalog: createRouterCatalog(),
    });
    try {
      const decision = harness.runtime.route({
        prompt: "Refactor this TypeScript function to use async/await",
      });
      expect(decision.routed).toBe(true);
      expect(decision.task.taskType).toBe("coding");
      expect(decision.modelId).toBe("mock-coding");
      expect(decision.reasons.length).toBeGreaterThan(0);
    } finally {
      harness.cleanup();
    }
  });

  it("honors manual preferredModelId", () => {
    const harness = createLocalAiHarness();
    try {
      const decision = harness.runtime.route({
        prompt: "hello",
        preferredModelId: "mock-coding",
      });
      expect(decision.mode).toBe("manual");
      expect(decision.modelId).toBe("mock-coding");
    } finally {
      harness.cleanup();
    }
  });

  it("falls back when catalog is empty", () => {
    const harness = createLocalAiHarness({
      routerCatalog: [],
      defaultModelId: "mock-general",
    });
    try {
      const decision = harness.runtime.route({ prompt: "hello there" });
      expect(decision.modelId).toBe("mock-general");
      expect(decision.routed).toBe(true);
    } finally {
      harness.cleanup();
    }
  });
});

describe("Phase 2 integration — hardware detection", () => {
  it("detects host profile and lists resource profiles", () => {
    const hw = detectHardware({ skipGpuProbe: true });
    expect(hw.profileId).toMatch(/^(low|balanced|performance)$/);
    expect(hw.memory.totalGb).toBeGreaterThan(0);
    expect(hw.cpu.logicalProcessors).toBeGreaterThan(0);

    const profiles = listResourceProfiles();
    expect(profiles.map((p) => p.id).sort()).toEqual([
      "balanced",
      "low",
      "performance",
    ]);

    const recs = recommendModelsForProfile(
      createRouterCatalog().map((m) => ({
        id: m.id,
        sizeBytes: m.sizeBytes,
        requirements: m.requirements,
        capabilities: m.capabilities,
      })),
      { profileId: hw.profileId, hardware: hw },
    );
    expect(Array.isArray(recs)).toBe(true);
  });
});

describe("Phase 2 integration — offline operation", () => {
  it("keeps mock inference working while blocking URL install and cloud stub", async () => {
    const harness = createLocalAiHarness({
      offlineMode: true,
      cloudProviders: false,
      withModelsDir: true,
    });
    try {
      expect(harness.runtime.listProviders()).not.toContain("cloud-stub");

      await harness.runtime.loadModel("mock-general");
      const result = await harness.runtime.generate({
        messages: [{ role: "user", content: "offline ok" }],
      });
      expect(result.text).toContain("offline ok");

      const installer = createModelInstaller({
        modelsDir: harness.modelsDir!,
        registry: harness.modelRegistry!,
      });
      const blocked = await installer.install({
        source: "https://example.com/models/demo.gguf",
        category: "general",
        offlineMode: true,
        dryRun: true,
      });
      expect(blocked.ok).toBe(false);
      expect(blocked.message).toMatch(/offline/i);

      const offline = assessOfflineCapability({
        offlineMode: true,
        cloudProvidersEnabled: false,
        localInferenceReady: true,
        providerId: "mock",
        internetReachable: "unknown",
      });
      expect(offline.blockedOperations).toContain("model_install_url");
      expect(offline.blockedOperations).toContain("cloud_inference");
    } finally {
      harness.cleanup();
    }
  });
});

describe("Phase 2 integration — critical path stability", () => {
  it("runs hardware → runtime → load → route → generate without failure", async () => {
    const hw = detectHardware({ skipGpuProbe: true });
    expect(hw.profileId).toBeTruthy();

    const harness = createLocalAiHarness();
    try {
      const health = await harness.runtime.health();
      expect(health.ok).toBe(true);
      expect(health.provider).toBe("mock");

      await harness.runtime.loadModel();
      const routed = harness.runtime.route({
        prompt: "Write a unit test for this function",
      });
      expect(routed.modelId).toBeTruthy();

      const result = await harness.runtime.generate({
        messages: [{ role: "user", content: "critical path" }],
        modelId: routed.modelId,
      });
      expect(result.provider).toBe("mock");
      expect(result.text.length).toBeGreaterThan(0);

      const metrics = harness.runtime.getMetrics();
      expect(metrics.errorCount).toBe(0);
      expect(metrics.inference.count).toBeGreaterThanOrEqual(1);
    } finally {
      harness.cleanup();
    }
  });
});
