/**
 * Best-effort GPU / VRAM detection via platform tools (no native deps).
 */
import type { SystemProbe } from "./probe.js";
import type { DetectedGpu } from "./types.js";

function bytesFromMiB(mib: number): number {
  return Math.round(mib * 1024 * 1024);
}

function parseNvidiaSmi(stdout: string): DetectedGpu[] {
  const gpus: DetectedGpu[] = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const [name, memoryTotal] = trimmed.split(",").map((part) => part.trim());
    if (!name) {
      continue;
    }
    const mib = memoryTotal ? Number.parseFloat(memoryTotal) : Number.NaN;
    const vramBytes = Number.isFinite(mib) ? bytesFromMiB(mib) : undefined;
    gpus.push({
      name,
      vendor: "NVIDIA",
      vramBytes,
      vramGb:
        vramBytes !== undefined
          ? Math.round((vramBytes / (1024 * 1024 * 1024)) * 10) / 10
          : undefined,
      integrated: false,
      available: true,
    });
  }
  return gpus;
}

function parseDarwinSystemProfiler(stdout: string): DetectedGpu[] {
  try {
    const parsed = JSON.parse(stdout) as {
      SPDisplaysDataType?: Array<Record<string, unknown>>;
    };
    const displays = parsed.SPDisplaysDataType ?? [];
    const gpus: DetectedGpu[] = [];
    for (const display of displays) {
      const name =
        (display.sppci_model as string | undefined) ??
        (display._name as string | undefined) ??
        "Unknown GPU";
      const vramRaw =
        (display.spdisplays_vram as string | undefined) ??
        (display.spdisplays_vram_shared as string | undefined);
      let vramBytes: number | undefined;
      if (vramRaw) {
        const match = /(\d+(?:\.\d+)?)\s*(GB|MB)/i.exec(vramRaw);
        if (match) {
          const value = Number.parseFloat(match[1]!);
          vramBytes =
            match[2]!.toUpperCase() === "GB"
              ? Math.round(value * 1024 * 1024 * 1024)
              : bytesFromMiB(value);
        }
      }
      const chipset = String(display.sppci_model ?? name).toLowerCase();
      const integrated =
        chipset.includes("apple") ||
        chipset.includes("intel iris") ||
        chipset.includes("uhd") ||
        Boolean(display.spdisplays_vram_shared);

      gpus.push({
        name,
        vendor: chipset.includes("apple")
          ? "Apple"
          : chipset.includes("amd")
            ? "AMD"
            : chipset.includes("nvidia")
              ? "NVIDIA"
              : chipset.includes("intel")
                ? "Intel"
                : undefined,
        vramBytes,
        vramGb:
          vramBytes !== undefined
            ? Math.round((vramBytes / (1024 * 1024 * 1024)) * 10) / 10
            : undefined,
        integrated,
        available: true,
      });
    }
    return gpus;
  } catch {
    return [];
  }
}

function appleSiliconFallback(
  probe: SystemProbe,
  cpuModel: string,
): DetectedGpu[] {
  if (probe.platform() !== "darwin" || probe.arch() !== "arm64") {
    return [];
  }
  if (!/apple/i.test(cpuModel)) {
    return [];
  }
  return [
    {
      name: cpuModel.trim() || "Apple Silicon",
      vendor: "Apple",
      integrated: true,
      available: true,
    },
  ];
}

/**
 * Detect GPUs. Returns [] when probes fail or are skipped.
 */
export function detectGpus(
  probe: SystemProbe,
  options: { timeoutMs: number; skipProbe: boolean; cpuModel: string },
): DetectedGpu[] {
  if (options.skipProbe) {
    return appleSiliconFallback(probe, options.cpuModel);
  }

  const platform = probe.platform();

  if (platform === "darwin") {
    const result = probe.runCommand(
      "system_profiler",
      ["SPDisplaysDataType", "-json"],
      options.timeoutMs,
    );
    if (result && result.status === 0 && result.stdout.trim()) {
      const parsed = parseDarwinSystemProfiler(result.stdout);
      if (parsed.length > 0) {
        return parsed;
      }
    }
    return appleSiliconFallback(probe, options.cpuModel);
  }

  if (platform === "linux") {
    const nvidia = probe.runCommand(
      "nvidia-smi",
      ["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
      options.timeoutMs,
    );
    if (nvidia && nvidia.status === 0 && nvidia.stdout.trim()) {
      const parsed = parseNvidiaSmi(nvidia.stdout);
      if (parsed.length > 0) {
        return parsed;
      }
    }
    return [];
  }

  if (platform === "win32") {
    const result = probe.runCommand(
      "wmic",
      [
        "path",
        "win32_VideoController",
        "get",
        "Name,AdapterRAM",
        "/format:csv",
      ],
      options.timeoutMs,
    );
    if (result && result.status === 0 && result.stdout.trim()) {
      const gpus: DetectedGpu[] = [];
      const lines = result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      for (const line of lines.slice(1)) {
        const parts = line.split(",");
        if (parts.length < 3) {
          continue;
        }
        const adapterRam = Number.parseInt(parts[1] ?? "", 10);
        const name = parts.slice(2).join(",").trim();
        if (!name || /^name$/i.test(name)) {
          continue;
        }
        const vramBytes =
          Number.isFinite(adapterRam) && adapterRam > 0
            ? adapterRam
            : undefined;
        gpus.push({
          name,
          vramBytes,
          vramGb:
            vramBytes !== undefined
              ? Math.round((vramBytes / (1024 * 1024 * 1024)) * 10) / 10
              : undefined,
          integrated: /intel|uhd|iris/i.test(name),
          available: true,
        });
      }
      return gpus;
    }
  }

  return [];
}
