/**
 * Discover local GGUF installs and map them to registry entries.
 */
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

import { validateGgufFile } from "../gguf.js";
import type { RegisterModelInput } from "./types.js";

export interface ScanInstalledModelsOptions {
  modelsDir: string;
  provider?: string;
  /** Default context length metadata when unknown. */
  defaultContextLength?: number;
  defaultCapabilities?: string[];
}

/**
 * Scan a models directory for installed GGUF files.
 */
export function scanInstalledGgufModels(
  options: ScanInstalledModelsOptions,
): RegisterModelInput[] {
  const {
    modelsDir,
    provider = "llamacpp",
    defaultContextLength = 4096,
    defaultCapabilities = ["chat", "local"],
  } = options;

  let entries: string[];
  try {
    entries = readdirSync(modelsDir);
  } catch {
    return [];
  }

  const models: RegisterModelInput[] = [];
  for (const name of entries) {
    if (!name.toLowerCase().endsWith(".gguf")) {
      continue;
    }
    const full = path.join(modelsDir, name);
    const validation = validateGgufFile(full);
    const id = name.replace(/\.gguf$/i, "");
    let sizeBytes: number | undefined = validation.sizeBytes;
    if (sizeBytes === undefined) {
      try {
        sizeBytes = statSync(full).size;
      } catch {
        sizeBytes = undefined;
      }
    }

    models.push({
      id,
      name: id,
      provider,
      version: "1.0.0",
      format: "gguf",
      sizeBytes,
      contextLength: defaultContextLength,
      capabilities: [...defaultCapabilities],
      requirements: {
        acceleration: "cpu",
        notes: "GGUF via llama.cpp; GPU optional via hardware.gpuLayers",
      },
      location: full,
      status: validation.ok ? "available" : "error",
    });
  }

  return models.sort((a, b) => a.id.localeCompare(b.id));
}
