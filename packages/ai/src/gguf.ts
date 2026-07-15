/**
 * GGUF helpers — validate and resolve local model weights (Architecture/17).
 */
import { existsSync, openSync, readSync, closeSync, statSync } from "node:fs";
import path from "node:path";

import { AiRuntimeError } from "./errors.js";

/** GGUF magic is ASCII "GGUF" (little-endian uint32 0x46554747). */
export const GGUF_MAGIC = "GGUF";

export interface GgufValidationResult {
  ok: boolean;
  path: string;
  sizeBytes?: number;
  reason?: string;
}

/**
 * Check that a file exists and starts with the GGUF magic header.
 */
export function validateGgufFile(filePath: string): GgufValidationResult {
  if (!existsSync(filePath)) {
    return { ok: false, path: filePath, reason: "file not found" };
  }

  let sizeBytes: number | undefined;
  try {
    sizeBytes = statSync(filePath).size;
  } catch {
    sizeBytes = undefined;
  }

  const fd = openSync(filePath, "r");
  try {
    const buf = Buffer.alloc(4);
    const n = readSync(fd, buf, 0, 4, 0);
    if (n < 4) {
      return {
        ok: false,
        path: filePath,
        sizeBytes,
        reason: "file too short for GGUF header",
      };
    }
    const magic = buf.toString("ascii");
    if (magic !== GGUF_MAGIC) {
      return {
        ok: false,
        path: filePath,
        sizeBytes,
        reason: `expected GGUF magic, found ${JSON.stringify(magic)}`,
      };
    }
    return { ok: true, path: filePath, sizeBytes };
  } finally {
    closeSync(fd);
  }
}

/**
 * Resolve a model id or path to an absolute/relative GGUF file under modelsDir.
 * Accepts: "qwen", "qwen.gguf", or absolute/relative path ending in .gguf.
 */
export function resolveGgufPath(
  modelIdOrPath: string,
  modelsDir?: string,
): string {
  const trimmed = modelIdOrPath.trim();
  if (!trimmed) {
    throw new AiRuntimeError("Empty model id", { code: "model_id_required" });
  }

  if (trimmed.toLowerCase().endsWith(".gguf") || path.isAbsolute(trimmed)) {
    return path.resolve(trimmed);
  }

  if (modelsDir) {
    const withExt = path.resolve(modelsDir, `${trimmed}.gguf`);
    if (existsSync(withExt)) {
      return withExt;
    }
    const asIs = path.resolve(modelsDir, trimmed);
    if (existsSync(asIs)) {
      return asIs;
    }
    return withExt;
  }

  return path.resolve(`${trimmed}.gguf`);
}

/**
 * Validate or throw — used by llama.cpp load path.
 */
export function requireValidGguf(filePath: string): GgufValidationResult {
  const result = validateGgufFile(filePath);
  if (!result.ok) {
    throw new AiRuntimeError(
      `Unsupported or missing GGUF model at ${filePath}: ${result.reason ?? "invalid"}`,
      { code: "invalid_gguf", provider: "llamacpp" },
    );
  }
  return result;
}
