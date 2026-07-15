import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { GGUF_MAGIC } from "../gguf.js";
import { createModelRegistry } from "./registry.js";
import { InMemoryModelRegistryStore } from "./memory-store.js";
import { scanInstalledGgufModels } from "./discover.js";

describe("ModelRegistry", () => {
  it("registers and queries models in memory", () => {
    const registry = createModelRegistry({
      store: new InMemoryModelRegistryStore(),
    });

    registry.register({
      id: "phi-3",
      name: "Phi-3 Mini",
      provider: "llamacpp",
      version: "3.0.0",
      format: "gguf",
      sizeBytes: 2_000_000_000,
      contextLength: 4096,
      capabilities: ["chat", "local"],
      requirements: { minRamGb: 8, acceleration: "cpu" },
      location: "/models/phi-3.gguf",
      status: "available",
    });

    expect(registry.get("phi-3")?.name).toBe("Phi-3 Mini");
    expect(registry.list({ capability: "chat" })).toHaveLength(1);
    expect(registry.list({ status: "available" })[0]?.contextLength).toBe(4096);
    expect(registry.remove("phi-3")).toBe(true);
    expect(registry.list()).toHaveLength(0);
  });

  it("syncFromDisk registers installed GGUF files", () => {
    const dir = join(tmpdir(), `atlas-models-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    try {
      const gguf = Buffer.concat([
        Buffer.from(GGUF_MAGIC),
        Buffer.alloc(64, 0),
      ]);
      writeFileSync(join(dir, "tiny-chat.gguf"), gguf);
      writeFileSync(join(dir, "readme.txt"), "ignore me");

      const discovered = scanInstalledGgufModels({ modelsDir: dir });
      expect(discovered).toHaveLength(1);
      expect(discovered[0]?.id).toBe("tiny-chat");
      expect(discovered[0]?.format).toBe("gguf");
      expect(discovered[0]?.capabilities).toContain("chat");

      const registry = createModelRegistry({ modelsDir: dir });
      expect(registry.syncFromDisk()).toBe(1);
      const listed = registry.list({ format: "gguf" });
      expect(listed).toHaveLength(1);
      expect(listed[0]?.location).toContain("tiny-chat.gguf");
      expect(listed[0]?.requirements.acceleration).toBe("cpu");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
