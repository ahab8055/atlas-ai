/**
 * Hardware profile for local inference (Architecture/09 Hardware Acceleration).
 * CPU is the default; GPU layers are reserved for future acceleration.
 */

export type AccelerationMode = "cpu" | "gpu";

export interface HardwareProfile {
  /** Execution target. Default: cpu. */
  acceleration: AccelerationMode;
  /**
   * CPU threads for llama.cpp (`-t`).
   * `0` / undefined = let the runtime choose (typically all cores).
   */
  threads?: number;
  /**
   * Number of layers offloaded to GPU (`-ngl` / `--n-gpu-layers`).
   * `0` = CPU-only. Non-zero enables GPU path when acceleration is `gpu`.
   */
  gpuLayers: number;
  /** Context window size (`-c`). */
  contextSize: number;
}

export const DEFAULT_CPU_HARDWARE: HardwareProfile = {
  acceleration: "cpu",
  threads: 0,
  gpuLayers: 0,
  contextSize: 4096,
};

/**
 * Resolve effective GPU layer count from profile.
 * CPU mode always forces 0 layers offloaded (safe on machines without a GPU).
 */
export function resolveGpuLayers(profile: HardwareProfile): number {
  if (profile.acceleration === "cpu") {
    return 0;
  }
  return Math.max(0, profile.gpuLayers);
}

export function mergeHardwareProfile(
  base: HardwareProfile,
  patch?: Partial<HardwareProfile>,
): HardwareProfile {
  if (!patch) {
    return { ...base };
  }
  return {
    acceleration: patch.acceleration ?? base.acceleration,
    threads: patch.threads ?? base.threads,
    gpuLayers: patch.gpuLayers ?? base.gpuLayers,
    contextSize: patch.contextSize ?? base.contextSize,
  };
}
