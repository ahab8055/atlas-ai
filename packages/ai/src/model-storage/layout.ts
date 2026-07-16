/**
 * Model directory layout helpers (Architecture/25 storage structure).
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import {
  MODEL_CATEGORIES,
  type EnsureStructureResult,
  type ModelCategory,
} from "./types.js";

export function categoryPath(
  modelsDir: string,
  category: ModelCategory,
): string {
  return path.join(modelsDir, category);
}

/**
 * Ensure modelsDir and Architecture/25 category folders exist.
 * Writes `.gitkeep` in empty category dirs so the layout is VCS-friendly.
 */
export function ensureModelDirectoryStructure(
  modelsDir: string,
): EnsureStructureResult {
  const created: string[] = [];
  const existing: string[] = [];

  const ensureDir = (dir: string): void => {
    if (existsSync(dir)) {
      existing.push(dir);
      return;
    }
    mkdirSync(dir, { recursive: true });
    created.push(dir);
  };

  ensureDir(modelsDir);

  for (const category of MODEL_CATEGORIES) {
    const dir = categoryPath(modelsDir, category);
    const wasMissing = !existsSync(dir);
    ensureDir(dir);
    if (wasMissing || created.includes(dir)) {
      const keep = path.join(dir, ".gitkeep");
      if (!existsSync(keep)) {
        writeFileSync(keep, "");
      }
    }
  }

  return { modelsDir, created, existing };
}

export function isStructureReady(modelsDir: string): boolean {
  if (!existsSync(modelsDir)) {
    return false;
  }
  return MODEL_CATEGORIES.every((category) =>
    existsSync(categoryPath(modelsDir, category)),
  );
}
