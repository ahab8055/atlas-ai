import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  createFileInferenceSettingsStore,
  createInferenceConfigManager,
  createMemoryInferenceSettingsStore,
  formatInferenceConfig,
  resolveInferenceConfig,
  sanitizeInferencePatch,
} from "./index.js";
import { DEFAULT_INFERENCE_CONFIG } from "./types.js";

describe("sanitizeInferencePatch", () => {
  it("clamps temperature and token limits", () => {
    const patch = sanitizeInferencePatch({
      temperature: 99,
      maxTokens: -5,
      contextLength: 50,
      stream: true,
    });
    expect(patch.temperature).toBe(2);
    expect(patch.maxTokens).toBe(1);
    expect(patch.contextLength).toBe(256);
    expect(patch.stream).toBe(true);
  });

  it("rejects secret-like fields", () => {
    expect(() =>
      sanitizeInferencePatch({ temperature: 0.5, apiKey: "sk-secret" }),
    ).toThrow(/secret/i);
  });
});

describe("resolveInferenceConfig", () => {
  it("applies model overrides over global", () => {
    const resolved = resolveInferenceConfig({
      base: DEFAULT_INFERENCE_CONFIG,
      stored: {
        version: 1,
        global: { temperature: 0.5, maxTokens: 128 },
        models: {
          "coding/foo": { temperature: 0.1, maxTokens: 1024 },
        },
        updatedAt: new Date().toISOString(),
      },
      modelId: "coding/foo",
    });
    expect(resolved.config.temperature).toBe(0.1);
    expect(resolved.config.maxTokens).toBe(1024);
    expect(resolved.sources.temperature).toBe("model:coding/foo");
    expect(resolved.sources.stream).toBe("defaults");
  });
});

describe("InferenceConfigManager", () => {
  it("persists per-model settings safely to disk", () => {
    const dir = mkdtempSync(join(tmpdir(), "atlas-inf-"));
    try {
      const manager = createInferenceConfigManager({ dataDir: dir });
      manager.setForModel("general/tiny", {
        temperature: 0.2,
        contextLength: 2048,
        stream: false,
      });
      const again = createInferenceConfigManager({ dataDir: dir });
      const resolved = again.resolve("general/tiny");
      expect(resolved.config.temperature).toBe(0.2);
      expect(resolved.config.contextLength).toBe(2048);
      expect(resolved.config.stream).toBe(false);

      const raw = JSON.parse(
        readFileSync(join(dir, "inference-settings.json"), "utf8"),
      ) as { models: Record<string, unknown> };
      expect(raw.models["general/tiny"]).toBeDefined();
      expect(JSON.stringify(raw)).not.toMatch(/apiKey|secret|password/i);
      expect(formatInferenceConfig(resolved)).toContain("contextLength: 2048");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("supports different configs for different models", () => {
    const store = createMemoryInferenceSettingsStore();
    const manager = createInferenceConfigManager({
      store,
      base: { ...DEFAULT_INFERENCE_CONFIG, temperature: 0.7 },
    });
    manager.setForModel("chat", { temperature: 0.9, maxTokens: 128 });
    manager.setForModel("code", { temperature: 0.2, maxTokens: 2048 });

    expect(manager.resolve("chat").config.temperature).toBe(0.9);
    expect(manager.resolve("code").config.maxTokens).toBe(2048);
    expect(manager.listModelOverrides()).toEqual(["chat", "code"]);
  });
});

describe("file store", () => {
  it("creates empty settings when file missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "atlas-inf-miss-"));
    try {
      const store = createFileInferenceSettingsStore(dir);
      expect(store.load().models).toEqual({});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
