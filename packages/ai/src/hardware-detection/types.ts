/**
 * Hardware detection domain types (Architecture/25 Hardware Detection System).
 */
import type { HardwareProfile } from "../hardware.js";
import type {
  ResourceProfileDefinition,
  ResourceProfileId,
} from "./resource-profiles.js";

/**
 * Device capability profile id.
 * Prefer `ResourceProfileId` (`low` | `balanced` | `performance`).
 * Legacy aliases `standard` / `high` are normalized at classify time.
 */
export type HardwareTier = ResourceProfileId;

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
  /**
   * Active resource profile id (`low` | `balanced` | `performance`).
   * Same value as `tier` (legacy field name).
   */
  profileId: ResourceProfileId;
  /** @deprecated Use `profileId`. */
  tier: ResourceProfileId;
  /** Full profile definition (categories + model guidance). */
  profile: ResourceProfileDefinition;
  /** Suggested llama.cpp inference profile from detection. */
  inferenceProfile: HardwareProfile;
  notes: string[];
}

export interface ModelSuitabilityResult {
  suitable: boolean;
  reasons: string[];
}
