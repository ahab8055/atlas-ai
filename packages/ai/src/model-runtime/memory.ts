/**
 * Memory accounting helpers for the Model Runtime Manager.
 */
import type { LoadedModelState, RuntimeMemoryState } from "./types.js";

/** Prefer explicit size; else fall back to minRamGb heuristic (~1 GiB per GB declared). */
export function estimateModelMemoryBytes(input: {
  sizeBytes?: number;
  minRamGb?: number;
}): number | undefined {
  if (typeof input.sizeBytes === "number" && input.sizeBytes > 0) {
    return Math.floor(input.sizeBytes);
  }
  if (typeof input.minRamGb === "number" && input.minRamGb > 0) {
    return Math.floor(input.minRamGb * 1024 ** 3);
  }
  return undefined;
}

export function sumEstimatedMemory(loaded: LoadedModelState[]): number {
  return loaded.reduce((sum, m) => sum + (m.estimatedMemoryBytes ?? 0), 0);
}

export function buildMemoryState(
  loaded: LoadedModelState[],
  options: {
    budgetBytes?: number;
    hostFreeBytes?: number;
    hostTotalBytes?: number;
  } = {},
): RuntimeMemoryState {
  const estimatedUsedBytes = sumEstimatedMemory(loaded);
  const budgetBytes = options.budgetBytes;
  const withinBudget =
    budgetBytes === undefined || estimatedUsedBytes <= budgetBytes;
  return {
    estimatedUsedBytes,
    budgetBytes,
    withinBudget,
    hostFreeBytes: options.hostFreeBytes,
    hostTotalBytes: options.hostTotalBytes,
  };
}

/** Default soft budget: 50% of host total RAM when known. */
export function defaultMemoryBudgetBytes(
  hostTotalBytes?: number,
): number | undefined {
  if (typeof hostTotalBytes !== "number" || hostTotalBytes <= 0) {
    return undefined;
  }
  return Math.floor(hostTotalBytes * 0.5);
}

export function formatBytesShort(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 ** 2) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  if (bytes < 1024 ** 3) {
    return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
  }
  return `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
}
