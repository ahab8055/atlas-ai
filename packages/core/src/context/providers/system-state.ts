import type { PlatformInfo } from "@atlas-ai/platform";
import { getDefaultPlatformManager } from "@atlas-ai/platform";

import type { ContextContribution, ContextProvider } from "../types.js";

function resolvePlatformInfo(platform?: PlatformInfo): PlatformInfo {
  return platform ?? getDefaultPlatformManager().getServices().info;
}

/**
 * System state provider — platform identity comes from @atlas-ai/platform
 * (no direct process.platform / process.arch in core).
 */
export function createSystemStateProvider(
  platform?: PlatformInfo,
): ContextProvider {
  const info = resolvePlatformInfo(platform);
  return {
    id: "system",
    load({ request }) {
      return {
        source: "system",
        systemState: {
          runtime: "atlas-core",
          source: request.source,
          platform: info.id,
          arch: info.arch,
          nodeVersion: info.runtime.version || "unknown",
          kernelVersion: info.kernelVersion,
          collectedAt: new Date().toISOString(),
        },
      } satisfies ContextContribution;
    },
  };
}
