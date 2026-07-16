/**
 * Pre-install compatibility checks (Architecture/25).
 * Issues are warnings by default — Atlas displays them and may still install.
 */
import { detectHardware } from "../hardware-detection/detect.js";
import type { DetectedHardware } from "../hardware-detection/types.js";
import type { ModelRequirements } from "../model-registry/types.js";
import type { CompatibilityReport, CompatibilityWarning } from "./types.js";

export interface CompatibilityCheckInput {
  requirements?: ModelRequirements;
  /** Estimated / known model size in bytes. */
  sizeBytes?: number;
  hardware?: DetectedHardware;
}

export function checkInstallCompatibility(
  input: CompatibilityCheckInput = {},
): CompatibilityReport {
  const hardware = input.hardware ?? detectHardware({ skipGpuProbe: false });
  const warnings: CompatibilityWarning[] = [];
  const req = input.requirements ?? {};
  const profile = hardware.profile;

  if (
    typeof req.minRamGb === "number" &&
    hardware.memory.totalGb + 1e-9 < req.minRamGb
  ) {
    warnings.push({
      code: "low_ram",
      severity: "warning",
      message: `Model recommends ≥${req.minRamGb}GB RAM; host has ${hardware.memory.totalGb}GB.`,
    });
  }

  if (req.acceleration === "gpu" && !hardware.gpuAvailable) {
    warnings.push({
      code: "gpu_required",
      severity: "warning",
      message:
        "Model prefers GPU acceleration but no GPU was detected (CPU fallback may be slow).",
    });
  }

  if (
    typeof req.gpuLayersRecommended === "number" &&
    req.gpuLayersRecommended > 0 &&
    !hardware.gpuAvailable
  ) {
    warnings.push({
      code: "gpu_layers",
      severity: "warning",
      message: `Model recommends ${req.gpuLayersRecommended} GPU layers; none available.`,
    });
  }

  if (
    input.sizeBytes !== undefined &&
    profile.modelGuidance.maxSizeBytes !== undefined &&
    input.sizeBytes > profile.modelGuidance.maxSizeBytes
  ) {
    warnings.push({
      code: "profile_size",
      severity: "warning",
      message: `Model size exceeds ${profile.id} profile guidance (${profile.modelGuidance.sizeClass} models preferred).`,
    });
  }

  if (
    typeof req.minRamGb === "number" &&
    req.minRamGb > profile.modelGuidance.maxMinRamGb
  ) {
    warnings.push({
      code: "profile_size",
      severity: "warning",
      message: `Model minRam ${req.minRamGb}GB is above ${profile.id} profile cap (${profile.modelGuidance.maxMinRamGb}GB).`,
    });
  }

  // Soft OS note for exotic arches when GPU-oriented models are installed on cpu-only.
  if (hardware.os.arch === "ia32" && (input.sizeBytes ?? 0) > 2 * 1024 ** 3) {
    warnings.push({
      code: "os_arch",
      severity: "warning",
      message: "32-bit OS detected; large GGUF models may not load reliably.",
    });
  }

  const hasError = warnings.some((w) => w.severity === "error");
  return {
    ok: warnings.length === 0,
    canProceed: !hasError,
    warnings,
    hardware,
    profileId: hardware.profileId,
  };
}
