import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { GGUF_MAGIC } from "../gguf.js";
import {
  MODEL_CATEGORIES,
  createModelStorageManager,
  ensureModelDirectoryStructure,
} from "./index.js";

function writeToyGguf(filePath: string): void {
  writeFileSync(
    filePath,
    Buffer.concat([Buffer.from(GGUF_MAGIC), Buffer.alloc(32, 0)]),
  );
}

describe("ModelStorageManager", () => {
  it("ensures Architecture/25 category directory structure", () => {
    const dir = join(tmpdir(), `atlas-storage-struct-${Date.now()}`);
    try {
      const result = ensureModelDirectoryStructure(dir);
      expect(result.created.length).toBeGreaterThanOrEqual(1);
      for (const category of MODEL_CATEGORIES) {
        expect(readFileSync(join(dir, category, ".gitkeep"))).toBeTruthy();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("tracks usage, detects invalid models, and supports removal", () => {
    const dir = join(tmpdir(), `atlas-storage-usage-${Date.now()}`);
    mkdirSync(join(dir, "general"), { recursive: true });
    mkdirSync(join(dir, "coding"), { recursive: true });
    try {
      writeToyGguf(join(dir, "root-model.gguf"));
      writeToyGguf(join(dir, "general", "chat.gguf"));
      writeFileSync(join(dir, "coding", "bad.gguf"), Buffer.from("XXXX"));

      const storage = createModelStorageManager({ modelsDir: dir });
      storage.ensureStructure();

      const usage = storage.getUsage();
      expect(usage.structureReady).toBe(true);
      expect(usage.fileCount).toBe(3);
      expect(usage.validCount).toBe(2);
      expect(usage.invalidCount).toBe(1);
      expect(usage.totalBytes).toBeGreaterThan(0);
      expect(usage.bySlot.some((s) => s.slot === "coding")).toBe(true);

      const invalid = storage.validateAll().filter((m) => !m.validation.ok);
      expect(invalid).toHaveLength(1);
      expect(invalid[0]?.id).toBe("coding/bad");

      const removed = storage.remove("coding/bad");
      expect(removed.removed).toBe(true);
      expect(storage.getUsage().fileCount).toBe(2);
      expect(storage.getUsage().invalidCount).toBe(0);

      const refused = storage.remove("/etc/passwd");
      expect(refused.removed).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
