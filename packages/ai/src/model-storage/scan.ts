/**
 * Discover GGUF files under modelsDir (root + Architecture/25 categories).
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { validateGgufFile } from "../gguf.js";
import {
  MODEL_CATEGORIES,
  type ModelStorageSlot,
  type StoredModelFile,
} from "./types.js";

function isGgufName(name: string): boolean {
  return name.toLowerCase().endsWith(".gguf");
}

function modelIdFor(slot: ModelStorageSlot, fileName: string): string {
  const base = fileName.replace(/\.gguf$/i, "");
  return slot === "root" ? base : `${slot}/${base}`;
}

function readGgufEntry(
  slot: ModelStorageSlot,
  fileName: string,
  dirPath: string,
): StoredModelFile {
  const absolutePath = path.join(dirPath, fileName);
  const relativePath = slot === "root" ? fileName : path.join(slot, fileName);
  const validation = validateGgufFile(absolutePath);
  let sizeBytes = validation.sizeBytes ?? 0;
  if (!sizeBytes) {
    try {
      sizeBytes = statSync(absolutePath).size;
    } catch {
      sizeBytes = 0;
    }
  }
  return {
    id: modelIdFor(slot, fileName),
    path: absolutePath,
    relativePath,
    slot,
    sizeBytes,
    validation: { ...validation, sizeBytes },
  };
}

/**
 * List GGUF files in modelsDir root and each category subdirectory (one level).
 * Does not recurse arbitrarily — keeps layout controlled.
 */
export function listStoredGgufFiles(modelsDir: string): StoredModelFile[] {
  if (!modelsDir || !existsSync(modelsDir)) {
    return [];
  }

  const models: StoredModelFile[] = [];

  try {
    const rootEntries = readdirSync(modelsDir, { withFileTypes: true });
    for (const entry of rootEntries) {
      if (entry.isFile() && isGgufName(entry.name)) {
        models.push(readGgufEntry("root", entry.name, modelsDir));
      }
    }
  } catch {
    return models;
  }

  for (const category of MODEL_CATEGORIES) {
    const categoryDir = path.join(modelsDir, category);
    if (!existsSync(categoryDir)) {
      continue;
    }
    try {
      const entries = readdirSync(categoryDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && isGgufName(entry.name)) {
          models.push(readGgufEntry(category, entry.name, categoryDir));
        }
      }
    } catch {
      // skip unreadable category
    }
  }

  return models.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Resolve a model id or path to an absolute GGUF path under modelsDir.
 * Accepts: absolute path, `name.gguf`, `name`, `category/name`.
 */
export function resolveStoredModelPath(
  modelIdOrPath: string,
  modelsDir?: string,
): string | undefined {
  const trimmed = modelIdOrPath.trim();
  if (!trimmed) {
    return undefined;
  }

  if (path.isAbsolute(trimmed) && existsSync(trimmed)) {
    return trimmed;
  }

  if (trimmed.toLowerCase().endsWith(".gguf")) {
    const resolved = path.resolve(trimmed);
    if (existsSync(resolved)) {
      return resolved;
    }
    if (modelsDir) {
      const underRoot = path.resolve(modelsDir, trimmed);
      if (existsSync(underRoot)) {
        return underRoot;
      }
    }
  }

  if (!modelsDir) {
    return undefined;
  }

  const withoutExt = trimmed.replace(/\.gguf$/i, "");
  const candidates = [
    path.resolve(modelsDir, `${withoutExt}.gguf`),
    path.resolve(modelsDir, withoutExt),
  ];

  for (const category of MODEL_CATEGORIES) {
    const base = withoutExt.startsWith(`${category}/`)
      ? withoutExt.slice(category.length + 1)
      : withoutExt;
    candidates.push(path.resolve(modelsDir, category, `${base}.gguf`));
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  const listed = listStoredGgufFiles(modelsDir);
  const match = listed.find(
    (m) =>
      m.id === withoutExt ||
      m.id === trimmed ||
      path.basename(m.path).replace(/\.gguf$/i, "") === withoutExt,
  );
  return match?.path;
}
