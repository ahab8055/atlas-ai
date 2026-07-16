/**
 * Collect host hardware facts and build Architecture/25 profiles.
 */
import { classifyHardwareTier } from "./classify.js";
import { detectGpus } from "./gpu.js";
import { createNodeSystemProbe, type SystemProbe } from "./probe.js";
import { suggestInferenceProfile } from "./profile.js";
import type { DetectedCpu, DetectedHardware, DetectedMemory } from "./types.js";

export interface DetectHardwareOptions {
  probe?: SystemProbe;
  /** Skip shell GPU probes (CI / fast path). Apple Silicon still inferred. */
  skipGpuProbe?: boolean;
  gpuProbeTimeoutMs?: number;
  /** Override suggested context size. */
  contextSize?: number;
  preferCpu?: boolean;
}

function bytesToGb(bytes: number): number {
  return Math.round((bytes / (1024 * 1024 * 1024)) * 10) / 10;
}

function detectCpu(probe: SystemProbe): DetectedCpu {
  const cpus = probe.cpus();
  const model = cpus[0]?.model?.trim() || "Unknown CPU";
  const speeds = cpus
    .map((cpu) => cpu.speed)
    .filter((speed) => typeof speed === "number" && speed > 0);
  const speedMhz =
    speeds.length > 0
      ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length)
      : undefined;

  return {
    model,
    cores: cpus.length > 0 ? cpus.length : 1,
    logicalProcessors: cpus.length > 0 ? cpus.length : 1,
    speedMhz,
    arch: probe.arch(),
  };
}

function detectMemory(probe: SystemProbe): DetectedMemory {
  const totalBytes = probe.totalmem();
  const freeBytes = probe.freemem();
  return {
    totalBytes,
    freeBytes,
    totalGb: bytesToGb(totalBytes),
    freeGb: bytesToGb(freeBytes),
  };
}

/**
 * Detect CPU, RAM, GPU/VRAM (best-effort), and OS; emit tier + inference profile.
 */
export function detectHardware(
  options: DetectHardwareOptions = {},
): DetectedHardware {
  const probe = options.probe ?? createNodeSystemProbe();
  const cpu = detectCpu(probe);
  const memory = detectMemory(probe);
  const gpus = detectGpus(probe, {
    timeoutMs: options.gpuProbeTimeoutMs ?? 8_000,
    skipProbe: options.skipGpuProbe === true,
    cpuModel: cpu.model,
  });
  const gpuAvailable = gpus.some((gpu) => gpu.available);
  const tier = classifyHardwareTier({
    totalRamGb: memory.totalGb,
    gpus,
  });
  const inferenceProfile = suggestInferenceProfile({
    cpuLogicalProcessors: cpu.logicalProcessors,
    gpus,
    tier,
    contextSize: options.contextSize,
    preferCpu: options.preferCpu,
  });

  const notes: string[] = [];
  if (!gpuAvailable) {
    notes.push("No GPU detected; inference defaults to CPU (ngl=0).");
  } else if (inferenceProfile.acceleration === "gpu") {
    notes.push(
      `GPU available; suggested ngl=${inferenceProfile.gpuLayers} (override via config.ai.hardware).`,
    );
  }
  notes.push(`Resource tier: ${tier} (Architecture/25).`);

  return {
    detectedAt: new Date().toISOString(),
    os: {
      platform: probe.platform(),
      type: probe.type(),
      release: probe.release(),
      arch: probe.arch(),
      version: probe.version(),
    },
    cpu,
    memory,
    gpus,
    gpuAvailable,
    tier,
    inferenceProfile,
    notes,
  };
}
