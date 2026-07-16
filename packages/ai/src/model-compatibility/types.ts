/**
 * Model compatibility checker types (Architecture/25).
 * Used before install (advisory) and before run (enforced).
 */
import type { DetectedHardware } from "../hardware-detection/types.js";
import type { ResourceProfileId } from "../hardware-detection/resource-profiles.js";
import type { ModelRequirements } from "../model-registry/types.js";

/** install = warnings preferred; runtime = unmet hard requirements block execution. */
export type CompatibilityMode = "install" | "runtime";

export type CompatibilityIssueCategory =
  "ram" | "cpu" | "gpu" | "storage" | "other";

export type CompatibilityIssueCode =
  | "ram_insufficient"
  | "cpu_insufficient"
  | "gpu_required"
  | "gpu_layers"
  | "storage_insufficient"
  | "storage_unknown"
  | "profile_mismatch"
  | "arch_unsupported"
  | "other";

export interface CompatibilityIssue {
  code: CompatibilityIssueCode;
  category: CompatibilityIssueCategory;
  severity: "error" | "warning" | "info";
  message: string;
  required?: string;
  available?: string;
}

export interface CategoryCheckResult {
  ok: boolean;
  category: CompatibilityIssueCategory;
  required?: string;
  available?: string;
  detail: string;
}

export interface ModelCompatibilityResult {
  /** True when no error-severity issues (safe to proceed for this mode). */
  compatible: boolean;
  /** Story language: model is supported on this host for the mode. */
  supported: boolean;
  mode: CompatibilityMode;
  modelId?: string;
  profileId: ResourceProfileId;
  hardware: DetectedHardware;
  requirements: ModelRequirements;
  sizeBytes?: number;
  issues: CompatibilityIssue[];
  checks: {
    ram: CategoryCheckResult;
    cpu: CategoryCheckResult;
    gpu: CategoryCheckResult;
    storage: CategoryCheckResult;
  };
  summary: string;
}

export interface ModelCompatibilityInput {
  modelId?: string;
  requirements?: ModelRequirements;
  sizeBytes?: number;
  /** Models directory (or model file path) used for free-space checks. */
  modelsDir?: string;
  hardware?: DetectedHardware;
  mode?: CompatibilityMode;
  /** Skip GPU shell probes when detecting hardware. */
  skipGpuProbe?: boolean;
}
