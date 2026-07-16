/**
 * Hardware detection domain types (Architecture/25 Hardware Detection System).
 */
import type { HardwareProfile } from "../hardware.js";

/** Architecture/25 resource tiers for model selection. */
export type HardwareTier = "low" | "standard" | "high";

export interface DetectedCpu {
  model: string;
  cores: number;
  /** Logical processors (same as cores when Hyper-Threading unknown). */
  logicalProcessors: number;
  /** Average reported clock in MHz when available. */
  speedMhz?: number;
  arch: string;
}

export interface DetectedMemory {
  totalBytes: number;
  freeBytes: number;
  totalGb: number;
  freeGb: number;
}

export interface DetectedGpu {
  name: string;
  vendor?: string;
  /** Dedicated / reported VRAM when known (unified memory may omit this). */
  vramBytes?: number;
  vramGb?: number;
  /** True for iGPU / Apple Silicon Metal / unknown integrated. */
  integrated: boolean;
  available: boolean;
}

export interface DetectedOs {
  platform: NodeJS.Platform | string;
  type: string;
  release: string;
  arch: string;
  version?: string;
}

export interface DetectedHardware {
  detectedAt: string;
  os: DetectedOs;
  cpu: DetectedCpu;
  memory: DetectedMemory;
  gpus: DetectedGpu[];
  /** True when at least one usable GPU / accelerator is present. */
  gpuAvailable: boolean;
  /** Architecture/25 Low / Standard / High profile. */
  tier: HardwareTier;
  /** Suggested llama.cpp inference profile from detection. */
  inferenceProfile: HardwareProfile;
  notes: string[];
}

export interface ModelSuitabilityResult {
  suitable: boolean;
  reasons: string[];
}
