import { describe, expect, it } from "vitest";

import { MockInferenceProvider } from "../providers/mock.js";
import { createModelRuntimeManager, formatRuntimeSnapshot } from "./index.js";

describe("ModelRuntimeManager", () => {
  it("loads and unloads models dynamically while tracking state", async () => {
    const provider = new MockInferenceProvider();
    const now = 1_000_000;
    const manager = createModelRuntimeManager(provider, {
      idleUnloadMs: 1_000,
      maxLoadedModels: 1,
      memoryBudgetBytes: 8 * 1024 ** 3,
      resolveSizeBytes: () => 500 * 1024 ** 2,
      now: () => now,
      createSessionId: () => "sess-1",
    });

    expect(manager.getPhase()).toBe("idle");
    const loaded = await manager.ensureLoaded("mock-general");
    expect(loaded.id).toBe("mock-general");
    expect(manager.getPhase()).toBe("ready");
    expect(manager.getActiveModelId()).toBe("mock-general");

    const snap = manager.getSnapshot();
    expect(snap.loaded).toHaveLength(1);
    expect(snap.memory.estimatedUsedBytes).toBeGreaterThan(0);
    expect(snap.memory.withinBudget).toBe(true);
    expect(formatRuntimeSnapshot(snap)).toContain("Active model: mock-general");

    await manager.unload("mock-general");
    expect(manager.getPhase()).toBe("idle");
    expect(manager.getSnapshot().loaded).toHaveLength(0);
  });

  it("manages inference sessions and blocks idle reclaim while open", async () => {
    const provider = new MockInferenceProvider();
    let now = 5_000;
    const manager = createModelRuntimeManager(provider, {
      idleUnloadMs: 100,
      now: () => now,
      createSessionId: () => `sess-${now}`,
    });

    const session = await manager.createSession("mock-general");
    expect(session.status).toBe("open");
    expect(manager.listSessions({ status: "open" })).toHaveLength(1);

    manager.beginInference("mock-general", session.id);
    expect(manager.getPhase()).toBe("busy");
    manager.endInference("mock-general");
    expect(manager.getPhase()).toBe("ready");

    now += 10_000;
    const reclaimedWhileOpen = await manager.reclaimIdle();
    expect(reclaimedWhileOpen).toEqual([]);

    expect(manager.endSession(session.id)).toBe(true);
    now += 10_000;
    const reclaimed = await manager.reclaimIdle();
    expect(reclaimed).toContain("mock-general");
    expect(manager.getPhase()).toBe("idle");
  });

  it("switches models by unloading the previous when maxLoadedModels=1", async () => {
    const provider = new MockInferenceProvider();
    const manager = createModelRuntimeManager(provider, {
      maxLoadedModels: 1,
      idleUnloadMs: 0,
      resolveSizeBytes: (id) => (id === "mock-general" ? 100 : 200),
    });

    await manager.ensureLoaded("mock-general");
    await manager.ensureLoaded("mock-coding");
    const snap = manager.getSnapshot();
    expect(snap.loaded.map((m) => m.modelId)).toEqual(["mock-coding"]);
    expect(snap.activeModelId).toBe("mock-coding");
  });

  it("reports over-budget when estimated usage exceeds soft budget", async () => {
    const provider = new MockInferenceProvider();
    const manager = createModelRuntimeManager(provider, {
      memoryBudgetBytes: 100,
      resolveSizeBytes: () => 500,
      idleUnloadMs: 0,
    });
    await manager.ensureLoaded("mock-general");
    expect(manager.getSnapshot().memory.withinBudget).toBe(false);
  });
});
