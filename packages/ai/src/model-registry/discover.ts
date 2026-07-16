/**
 * Discover local GGUF installs and map them to registry entries.
 */
import { listStoredGgufFiles } from "../model-storage/scan.js";
import type { RegisterModelInput } from "./types.js";

export interface ScanInstalledModelsOptions {
  modelsDir: string;
  provider?: string;
  /** Default context length metadata when unknown. */
  defaultContextLength?: number;
  defaultCapabilities?: string[];
}

/**
 * Scan a models directory (root + category folders) for installed GGUF files.
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

  return listStoredGgufFiles(modelsDir).map((file) => {
    const capabilities = [...defaultCapabilities];
    if (file.slot === "coding" && !capabilities.includes("coding")) {
      capabilities.push("coding");
    }
    if (file.slot === "embeddings" && !capabilities.includes("embeddings")) {
      capabilities.push("embeddings");
    }
    if (file.slot === "speech" && !capabilities.includes("speech")) {
      capabilities.push("speech");
    }

    return {
      id: file.id,
      name: file.id,
      provider,
      version: "1.0.0",
      format: "gguf" as const,
      sizeBytes: file.sizeBytes,
      contextLength: defaultContextLength,
      capabilities,
      requirements: {
        acceleration: "cpu" as const,
        notes: "GGUF via llama.cpp; GPU optional via hardware.gpuLayers",
      },
      location: file.path,
      status: file.validation.ok ? ("available" as const) : ("error" as const),
    };
  });
}
