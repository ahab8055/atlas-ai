import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { GGUF_MAGIC } from "../gguf.js";
import { RESOURCE_PROFILES } from "../hardware-detection/resource-profiles.js";
import { createModelRegistry } from "../model-registry/registry.js";
import { checkInstallCompatibility } from "./compatibility.js";
import { createModelInstaller } from "./install.js";
import { checkInstallStorage } from "./storage-check.js";

function writeToyGguf(filePath: string): void {
  writeFileSync(
    filePath,
    Buffer.concat([Buffer.from(GGUF_MAGIC), Buffer.alloc(64, 0)]),
  );
}

describe("model installation workflow", () => {
  it("checks compatibility and surfaces RAM warnings", () => {
    const report = checkInstallCompatibility({
      requirements: { minRamGb: 512, acceleration: "gpu" },
      sizeBytes: 20 * 1024 ** 3,
      hardware: {
        detectedAt: new Date().toISOString(),
        os: {
          platform: "linux",
          type: "Linux",
          release: "1",
          arch: "x64",
        },
        cpu: {
          model: "Mock",
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
      },
    });

    expect(report.ok).toBe(false);
    expect(report.canProceed).toBe(true);
    expect(report.warnings.some((w) => w.code === "low_ram")).toBe(true);
    expect(report.warnings.some((w) => w.code === "gpu_required")).toBe(true);
  });

  it("reports storage availability under modelsDir", () => {
    const dir = join(tmpdir(), `atlas-install-storage-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    try {
      const result = checkInstallStorage({
        modelsDir: dir,
        requiredBytes: 1024,
      });
      expect(result.ok).toBe(true);
      expect(result.freeBytes === undefined || result.freeBytes > 0).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("installs a local GGUF, validates, and registers it", async () => {
    const root = join(tmpdir(), `atlas-install-${Date.now()}`);
    const modelsDir = join(root, "models");
    const source = join(root, "incoming.gguf");
    mkdirSync(root, { recursive: true });
    writeToyGguf(source);

    try {
      const registry = createModelRegistry({ modelsDir });
      const installer = createModelInstaller({
        modelsDir,
        registry,
        defaultProvider: "llamacpp",
      });

      const dry = await installer.install({
        source,
        category: "coding",
        dryRun: true,
        requirements: { minRamGb: 1, acceleration: "cpu" },
      });
      expect(dry.ok).toBe(true);
      expect(dry.dryRun).toBe(true);
      expect(registry.list()).toHaveLength(0);

      const result = await installer.install({
        source,
        category: "coding",
        capabilities: ["chat", "coding"],
        requirements: { minRamGb: 1, acceleration: "cpu" },
      });

      expect(result.ok).toBe(true);
      expect(result.modelId).toBe("coding/incoming");
      expect(result.registered?.id).toBe("coding/incoming");
      expect(result.destination).toContain("coding");
      expect(registry.get("coding/incoming")?.status).toBe("available");
      expect(registry.get("coding/incoming")?.location).toBe(
        result.destination,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects invalid GGUF sources", async () => {
    const root = join(tmpdir(), `atlas-install-bad-${Date.now()}`);
    const modelsDir = join(root, "models");
    const source = join(root, "bad.gguf");
    mkdirSync(root, { recursive: true });
    writeFileSync(source, Buffer.from("NOTG"));

    try {
      const registry = createModelRegistry({ modelsDir });
      const installer = createModelInstaller({ modelsDir, registry });
      const result = await installer.install({ source, category: "general" });
      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/Invalid GGUF/i);
      expect(registry.list()).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("downloads from URL via injected fetch and registers", async () => {
    const root = join(tmpdir(), `atlas-install-url-${Date.now()}`);
    const modelsDir = join(root, "models");
    mkdirSync(root, { recursive: true });

    try {
      const payload = Buffer.concat([
        Buffer.from(GGUF_MAGIC),
        Buffer.alloc(32, 0),
      ]);
      const fetchImpl: typeof fetch = async () =>
        new Response(payload, {
          status: 200,
          headers: { "content-length": String(payload.length) },
        });

      const registry = createModelRegistry({ modelsDir });
      const installer = createModelInstaller({
        modelsDir,
        registry,
        fetchImpl,
      });

      const result = await installer.install({
        source: "https://example.com/models/demo.gguf",
        category: "general",
      });

      expect(result.ok).toBe(true);
      expect(result.sourceKind).toBe("url");
      expect(result.registered?.id).toBe("general/demo");
      expect(registry.list()).toHaveLength(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
