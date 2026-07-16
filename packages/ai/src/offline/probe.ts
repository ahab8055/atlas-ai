/**
 * Soft internet reachability probe (status display only).
 */
import type { InternetReachability } from "./types.js";

export interface ProbeInternetOptions {
  /** Override probe (tests). */
  probe?: () => Promise<boolean>;
  /** Skip probe and return unknown (default for CI / fast paths). */
  skip?: boolean;
  /** Timeout ms (default 1000). */
  timeoutMs?: number;
}

async function defaultDnsProbe(timeoutMs: number): Promise<boolean> {
  const { lookup } = await import("node:dns/promises");
  try {
    await Promise.race([
      lookup("one.one.one.one"),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("probe timeout")), timeoutMs);
      }),
    ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Probe whether the host appears to have internet DNS.
 * Never required for local load/generate.
 */
export async function probeInternetReachability(
  options: ProbeInternetOptions = {},
): Promise<InternetReachability> {
  if (options.skip) {
    return "unknown";
  }
  try {
    const ok = options.probe
      ? await options.probe()
      : await defaultDnsProbe(options.timeoutMs ?? 1000);
    return ok ? "true" : "false";
  } catch {
    return "unknown";
  }
}
