/**
 * Model Compatibility Checker — RAM / CPU / GPU / storage (Architecture/25).
 */
import { AiRuntimeError } from "../errors.js";
import { detectHardware } from "../hardware-detection/detect.js";
import type { DetectedHardware } from "../hardware-detection/types.js";
import { getFreeDiskBytes } from "../model-install/storage-check.js";
import type { ModelRequirements } from "../model-registry/types.js";
import type {
  CategoryCheckResult,
  CompatibilityIssue,
  CompatibilityMode,
  ModelCompatibilityInput,
  ModelCompatibilityResult,
} from "./types.js";

function bytesToGb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024 * 1024)) * 10) / 10;
}

function minCpuRequired(req: ModelRequirements): number | undefined {
  if (typeof req.minLogicalProcessors === "number") {
    return req.minLogicalProcessors;
  }
  if (typeof req.minCpuCores === "number") {
    return req.minCpuCores;
  }
  return undefined;
}

function hardGpuRequired(
  req: ModelRequirements,
  mode: CompatibilityMode,
): boolean {
  if (req.requireGpu === true) {
    return true;
  }
  return mode === "runtime" && req.acceleration === "gpu";
}

function checkRam(
  req: ModelRequirements,
  hardware: DetectedHardware,
  mode: CompatibilityMode,
  issues: CompatibilityIssue[],
): CategoryCheckResult {
  const required = req.minRamGb;
  const available = `${hardware.memory.totalGb}GB`;
  if (typeof required !== "number") {
    return {
      ok: true,
      category: "ram",
      available,
      detail: `No min RAM declared; host has ${available}.`,
    };
  }
  const ok = hardware.memory.totalGb + 1e-9 >= required;
  if (!ok) {
    issues.push({
      code: "ram_insufficient",
      category: "ram",
      severity: mode === "runtime" ? "error" : "warning",
      message: `Insufficient RAM: model needs ≥${required}GB; host has ${hardware.memory.totalGb}GB.`,
      required: `${required}GB`,
      available,
    });
  }
  return {
    ok,
    category: "ram",
    required: `${required}GB`,
    available,
    detail: ok
      ? `RAM OK (${available} ≥ ${required}GB).`
      : `RAM shortfall (${available} < ${required}GB).`,
  };
}

function checkCpu(
  req: ModelRequirements,
  hardware: DetectedHardware,
  mode: CompatibilityMode,
  issues: CompatibilityIssue[],
  sizeBytes?: number,
): CategoryCheckResult {
  const requiredCores = minCpuRequired(req);
  const available = `${hardware.cpu.logicalProcessors} logical (${hardware.cpu.model})`;

  if (hardware.os.arch === "ia32" && (sizeBytes ?? 0) > 2 * 1024 ** 3) {
    issues.push({
      code: "arch_unsupported",
      category: "cpu",
      severity: mode === "runtime" ? "error" : "warning",
      message: "32-bit CPU/OS cannot reliably run large GGUF models (>2GB).",
      required: "64-bit",
      available: hardware.os.arch,
    });
    return {
      ok: false,
      category: "cpu",
      required: "64-bit",
      available: hardware.os.arch,
      detail: "Architecture unsupported for large models.",
    };
  }

  if (typeof requiredCores !== "number") {
    return {
      ok: true,
      category: "cpu",
      available,
      detail: `CPU OK — ${available}.`,
    };
  }

  const ok = hardware.cpu.logicalProcessors >= requiredCores;
  if (!ok) {
    issues.push({
      code: "cpu_insufficient",
      category: "cpu",
      severity: mode === "runtime" ? "error" : "warning",
      message: `Insufficient CPU: model needs ≥${requiredCores} logical processors; host has ${hardware.cpu.logicalProcessors}.`,
      required: String(requiredCores),
      available: String(hardware.cpu.logicalProcessors),
    });
  }
  return {
    ok,
    category: "cpu",
    required: String(requiredCores),
    available,
    detail: ok
      ? `CPU OK (${available} ≥ ${requiredCores}).`
      : `CPU shortfall (${hardware.cpu.logicalProcessors} < ${requiredCores}).`,
  };
}

function checkGpu(
  req: ModelRequirements,
  hardware: DetectedHardware,
  mode: CompatibilityMode,
  issues: CompatibilityIssue[],
): CategoryCheckResult {
  const available = hardware.gpuAvailable
    ? hardware.gpus.map((g) => g.name).join(", ") || "GPU present"
    : "none";
  const hard = hardGpuRequired(req, mode);

  if (hard && !hardware.gpuAvailable) {
    issues.push({
      code: "gpu_required",
      category: "gpu",
      severity: "error",
      message:
        "GPU required but none detected — model execution is not supported on this host.",
      required: "GPU",
      available: "none",
    });
    return {
      ok: false,
      category: "gpu",
      required: "GPU",
      available,
      detail: "GPU required and missing.",
    };
  }

  if (
    typeof req.gpuLayersRecommended === "number" &&
    req.gpuLayersRecommended > 0 &&
    !hardware.gpuAvailable
  ) {
    issues.push({
      code: "gpu_layers",
      category: "gpu",
      severity: "warning",
      message: `Model recommends ${req.gpuLayersRecommended} GPU layers; no GPU available (CPU fallback).`,
      required: `${req.gpuLayersRecommended} layers`,
      available: "none",
    });
  }

  if (
    req.acceleration === "gpu" &&
    !hardware.gpuAvailable &&
    mode === "install"
  ) {
    issues.push({
      code: "gpu_required",
      category: "gpu",
      severity: "warning",
      message:
        "Model prefers GPU acceleration but no GPU was detected (CPU fallback may be slow).",
      required: "GPU preferred",
      available: "none",
    });
  }

  const ok = !(hard && !hardware.gpuAvailable);
  return {
    ok,
    category: "gpu",
    required: hard ? "GPU" : (req.acceleration ?? "any"),
    available,
    detail: ok ? `GPU check OK (${available}).` : "GPU requirements not met.",
  };
}

function checkStorage(
  req: ModelRequirements,
  modelsDir: string | undefined,
  sizeBytes: number | undefined,
  _mode: CompatibilityMode,
  issues: CompatibilityIssue[],
): CategoryCheckResult {
  const freeBytes = modelsDir ? getFreeDiskBytes(modelsDir) : undefined;
  const available =
    freeBytes !== undefined ? `${bytesToGb(freeBytes)}GB free` : "unknown";

  let requiredGb: number | undefined =
    typeof req.minFreeStorageGb === "number" ? req.minFreeStorageGb : undefined;
  if (sizeBytes !== undefined) {
    const fromSize = bytesToGb(sizeBytes * 1.1);
    requiredGb =
      requiredGb === undefined ? fromSize : Math.max(requiredGb, fromSize);
  }

  if (requiredGb === undefined) {
    return {
      ok: true,
      category: "storage",
      available,
      detail: `No storage minimum declared; ${available}.`,
    };
  }

  if (freeBytes === undefined) {
    issues.push({
      code: "storage_unknown",
      category: "storage",
      severity: "warning",
      message: `Could not measure free disk space; need ~${requiredGb}GB.`,
      required: `${requiredGb}GB`,
      available: "unknown",
    });
    return {
      ok: true,
      category: "storage",
      required: `${requiredGb}GB`,
      available,
      detail: "Storage could not be measured.",
    };
  }

  const freeGb = bytesToGb(freeBytes);
  const ok = freeGb + 1e-9 >= requiredGb;
  if (!ok) {
    issues.push({
      code: "storage_insufficient",
      category: "storage",
      severity: "error",
      message: `Insufficient storage: need ~${requiredGb}GB free; have ${freeGb}GB.`,
      required: `${requiredGb}GB`,
      available: `${freeGb}GB`,
    });
  }
  return {
    ok,
    category: "storage",
    required: `${requiredGb}GB`,
    available: `${freeGb}GB`,
    detail: ok
      ? `Storage OK (${freeGb}GB ≥ ${requiredGb}GB).`
      : `Storage shortfall (${freeGb}GB < ${requiredGb}GB).`,
  };
}

function buildSummary(
  compatible: boolean,
  mode: CompatibilityMode,
  issues: CompatibilityIssue[],
): string {
  if (compatible && issues.length === 0) {
    return mode === "runtime"
      ? "Compatible — safe to load and run."
      : "Compatible — safe to install.";
  }
  if (compatible) {
    const warns = issues.filter((i) => i.severity === "warning").length;
    return `Compatible with ${warns} warning(s).`;
  }
  const errors = issues.filter((i) => i.severity === "error");
  return `Unsupported — ${errors.map((e) => e.message).join(" | ")}`;
}

/**
 * Verify model requirements against the host (RAM, CPU, GPU, storage).
 */
export function checkModelCompatibility(
  input: ModelCompatibilityInput = {},
): ModelCompatibilityResult {
  const mode: CompatibilityMode = input.mode ?? "runtime";
  const hardware =
    input.hardware ??
    detectHardware({ skipGpuProbe: input.skipGpuProbe === true });
  const requirements = input.requirements ?? {};
  const issues: CompatibilityIssue[] = [];

  const ram = checkRam(requirements, hardware, mode, issues);
  const cpu = checkCpu(requirements, hardware, mode, issues, input.sizeBytes);
  const gpu = checkGpu(requirements, hardware, mode, issues);
  const storage = checkStorage(
    requirements,
    input.modelsDir,
    input.sizeBytes,
    mode,
    issues,
  );

  const profile = hardware.profile;
  if (
    input.sizeBytes !== undefined &&
    profile.modelGuidance.maxSizeBytes !== undefined &&
    input.sizeBytes > profile.modelGuidance.maxSizeBytes
  ) {
    issues.push({
      code: "profile_mismatch",
      category: "other",
      severity: "warning",
      message: `Model size exceeds ${profile.id} profile guidance (${profile.modelGuidance.sizeClass} preferred).`,
    });
  }

  const compatible = !issues.some((i) => i.severity === "error");
  return {
    compatible,
    supported: compatible,
    mode,
    modelId: input.modelId,
    profileId: hardware.profileId,
    hardware,
    requirements,
    sizeBytes: input.sizeBytes,
    issues,
    checks: { ram, cpu, gpu, storage },
    summary: buildSummary(compatible, mode, issues),
  };
}

/**
 * Throw when runtime compatibility fails (blocks model execution).
 */
export function assertModelCompatible(
  input: ModelCompatibilityInput,
): ModelCompatibilityResult {
  const result = checkModelCompatibility({ ...input, mode: "runtime" });
  if (!result.compatible) {
    throw new AiRuntimeError(
      `Model incompatible with this host: ${result.summary}`,
      { code: "model_incompatible" },
    );
  }
  return result;
}

export function formatCompatibilityReport(
  result: ModelCompatibilityResult,
): string {
  const lines = [
    `Compatibility: ${result.compatible ? "SUPPORTED" : "UNSUPPORTED"} (${result.mode})`,
    ...(result.modelId ? [`Model: ${result.modelId}`] : []),
    `Profile: ${result.profileId}`,
    `Summary: ${result.summary}`,
    `RAM: ${result.checks.ram.detail}`,
    `CPU: ${result.checks.cpu.detail}`,
    `GPU: ${result.checks.gpu.detail}`,
    `Storage: ${result.checks.storage.detail}`,
  ];
  if (result.issues.length > 0) {
    lines.push("Issues:");
    for (const issue of result.issues) {
      lines.push(`  [${issue.severity}/${issue.category}] ${issue.message}`);
    }
  }
  return lines.join("\n");
}
