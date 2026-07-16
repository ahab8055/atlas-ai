/**
 * Pre-install compatibility checks (Architecture/25).
 * Delegates to the shared Model Compatibility Checker in `install` mode
 * (warnings preferred; storage shortage still errors).
 */
import { checkModelCompatibility } from "../model-compatibility/checker.js";
import type { DetectedHardware } from "../hardware-detection/types.js";
import type { ModelRequirements } from "../model-registry/types.js";
import type { CompatibilityReport, CompatibilityWarning } from "./types.js";

export interface CompatibilityCheckInput {
  requirements?: ModelRequirements;
  /** Estimated / known model size in bytes. */
  sizeBytes?: number;
  hardware?: DetectedHardware;
  modelsDir?: string;
}

export function checkInstallCompatibility(
  input: CompatibilityCheckInput = {},
): CompatibilityReport {
  const result = checkModelCompatibility({
    requirements: input.requirements,
    sizeBytes: input.sizeBytes,
    hardware: input.hardware,
    modelsDir: input.modelsDir,
    mode: "install",
  });

  const warnings: CompatibilityWarning[] = result.issues.map((issue) => ({
    code:
      issue.code === "ram_insufficient"
        ? "low_ram"
        : issue.code === "gpu_required"
          ? "gpu_required"
          : issue.code === "gpu_layers"
            ? "gpu_layers"
            : issue.code === "storage_insufficient" ||
                issue.code === "storage_unknown"
              ? "storage_tight"
              : issue.code === "arch_unsupported"
                ? "os_arch"
                : issue.code === "profile_mismatch"
                  ? "profile_size"
                  : "other",
    severity: issue.severity === "info" ? "warning" : issue.severity,
    message: issue.message,
  }));

  return {
    ok: result.issues.length === 0,
    canProceed: result.compatible,
    warnings,
    hardware: result.hardware,
    profileId: result.profileId,
  };
}
