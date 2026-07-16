/**
 * Disk free-space checks for model installation.
 */
import { existsSync, mkdirSync, statSync } from "node:fs";
import { statfsSync } from "node:fs";
import path from "node:path";

import type { StorageCheckResult } from "./types.js";

function bytesToGb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024 * 1024)) * 10) / 10;
}

/**
 * Free bytes available on the volume containing `dir`.
 * Uses `statfs` (Node 18.15+); returns undefined if unavailable.
 */
export function getFreeDiskBytes(dir: string): number | undefined {
  try {
    const target = existsSync(dir) ? dir : path.dirname(dir);
    if (!existsSync(target)) {
      mkdirSync(target, { recursive: true });
    }
    const stats = statfsSync(existsSync(dir) ? dir : target);
    return Number(stats.bavail) * Number(stats.bsize);
  } catch {
    return undefined;
  }
}

export function getFileSizeBytes(filePath: string): number | undefined {
  try {
    return statSync(filePath).size;
  } catch {
    return undefined;
  }
}

/**
 * Ensure the models volume has enough free space for `requiredBytes`
 * (plus a small safety margin).
 */
export function checkInstallStorage(options: {
  modelsDir: string;
  requiredBytes: number;
  /** Extra headroom (default 64MiB). */
  marginBytes?: number;
}): StorageCheckResult {
  const margin = options.marginBytes ?? 64 * 1024 * 1024;
  const needed = options.requiredBytes + margin;
  const freeBytes = getFreeDiskBytes(options.modelsDir);

  if (freeBytes === undefined) {
    return {
      ok: true,
      modelsDir: options.modelsDir,
      requiredBytes: options.requiredBytes,
      message:
        "Could not determine free disk space; proceeding without a hard storage check.",
    };
  }

  const ok = freeBytes >= needed;
  return {
    ok,
    modelsDir: options.modelsDir,
    requiredBytes: options.requiredBytes,
    freeBytes,
    freeGb: bytesToGb(freeBytes),
    message: ok
      ? `Storage OK: ${bytesToGb(freeBytes)}GB free (need ~${bytesToGb(needed)}GB).`
      : `Insufficient storage: ${bytesToGb(freeBytes)}GB free, need ~${bytesToGb(needed)}GB.`,
  };
}
