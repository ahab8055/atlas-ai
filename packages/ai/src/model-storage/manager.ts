/**
 * Model Storage Manager — controlled local model files (Architecture/25).
 *
 * Responsibilities (MVP): directory structure, usage, validation, removal.
 * Download / install marketplace remains a separate story.
 */
import { unlinkSync } from "node:fs";
import path from "node:path";

import { ensureModelDirectoryStructure, isStructureReady } from "./layout.js";
import { listStoredGgufFiles, resolveStoredModelPath } from "./scan.js";
import type {
  EnsureStructureResult,
  ModelRemovalResult,
  StorageUsageReport,
  StoredModelFile,
} from "./types.js";

export interface ModelStorageManagerOptions {
  modelsDir: string;
}

export class ModelStorageManager {
  readonly modelsDir: string;

  constructor(options: ModelStorageManagerOptions) {
    this.modelsDir = path.resolve(options.modelsDir);
  }

  /** Create models/ and category folders (general, coding, embeddings, speech). */
  ensureStructure(): EnsureStructureResult {
    return ensureModelDirectoryStructure(this.modelsDir);
  }

  /** List stored GGUF files under the controlled layout. */
  listFiles(): StoredModelFile[] {
    return listStoredGgufFiles(this.modelsDir);
  }

  /** Aggregate storage usage for monitoring. */
  getUsage(): StorageUsageReport {
    const models = this.listFiles();
    const slots = new Map<
      StoredModelFile["slot"],
      {
        fileCount: number;
        totalBytes: number;
        validCount: number;
        invalidCount: number;
      }
    >();

    for (const model of models) {
      const current = slots.get(model.slot) ?? {
        fileCount: 0,
        totalBytes: 0,
        validCount: 0,
        invalidCount: 0,
      };
      current.fileCount += 1;
      current.totalBytes += model.sizeBytes;
      if (model.validation.ok) {
        current.validCount += 1;
      } else {
        current.invalidCount += 1;
      }
      slots.set(model.slot, current);
    }

    const bySlot = [...slots.entries()]
      .map(([slot, stats]) => ({ slot, ...stats }))
      .sort((a, b) => a.slot.localeCompare(b.slot));

    return {
      modelsDir: this.modelsDir,
      structureReady: isStructureReady(this.modelsDir),
      fileCount: models.length,
      totalBytes: models.reduce((sum, m) => sum + m.sizeBytes, 0),
      validCount: models.filter((m) => m.validation.ok).length,
      invalidCount: models.filter((m) => !m.validation.ok).length,
      bySlot,
      models,
    };
  }

  /** Validate all stored model files; invalid entries are flagged. */
  validateAll(): StoredModelFile[] {
    return this.listFiles();
  }

  validateOne(modelIdOrPath: string): StoredModelFile | undefined {
    const absolute = resolveStoredModelPath(modelIdOrPath, this.modelsDir);
    if (!absolute) {
      return undefined;
    }
    return this.listFiles().find((m) => m.path === absolute);
  }

  /**
   * Remove a model weights file from the controlled location.
   * Does not touch SQLite registry — callers may unregister separately.
   */
  remove(modelIdOrPath: string): ModelRemovalResult {
    const absolute = resolveStoredModelPath(modelIdOrPath, this.modelsDir);
    if (!absolute) {
      return {
        id: modelIdOrPath,
        removed: false,
        reason: "model file not found under models directory",
      };
    }

    const resolvedRoot = path.resolve(this.modelsDir);
    const resolvedFile = path.resolve(absolute);
    if (
      resolvedFile !== resolvedRoot &&
      !resolvedFile.startsWith(resolvedRoot + path.sep)
    ) {
      return {
        id: modelIdOrPath,
        removed: false,
        path: absolute,
        reason: "refusing to delete a file outside the models directory",
      };
    }

    const listed = this.listFiles().find((m) => m.path === absolute);
    const id = listed?.id ?? modelIdOrPath;

    try {
      unlinkSync(absolute);
      return { id, removed: true, path: absolute };
    } catch (error) {
      return {
        id,
        removed: false,
        path: absolute,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export function createModelStorageManager(
  options: ModelStorageManagerOptions,
): ModelStorageManager {
  return new ModelStorageManager(options);
}
