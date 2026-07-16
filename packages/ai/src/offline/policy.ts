/**
 * Offline policy — block internet-dependent AI ops when offlineMode is on.
 */
import { AiRuntimeError } from "../errors.js";
import type { OfflineBlockedOperation } from "./types.js";

export type NetworkOperation =
  "model_install_url" | "cloud_inference" | "web_api";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export function isLoopbackHostname(hostname: string): boolean {
  const host = hostname
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  return LOOPBACK_HOSTS.has(host) || host === "::1";
}

/** True when URL points at loopback (local llama-server / local services). */
export function isLoopbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    return isLoopbackHostname(parsed.hostname);
  } catch {
    return false;
  }
}

export interface OfflinePolicyContext {
  offlineMode: boolean;
  cloudProvidersEnabled?: boolean;
}

/**
 * Assert a network-facing operation is allowed under the offline policy.
 * Loopback URLs are never blocked by offlineMode.
 */
export function assertNetworkOperationAllowed(
  operation: NetworkOperation,
  context: OfflinePolicyContext,
  options?: { url?: string },
): void {
  if (options?.url && isLoopbackUrl(options.url)) {
    return;
  }

  if (operation === "cloud_inference") {
    if (context.offlineMode) {
      throw new AiRuntimeError(
        "Cloud inference is blocked while offline mode is enabled (features.offlineMode).",
        { code: "offline_blocked" },
      );
    }
    if (context.cloudProvidersEnabled === false) {
      throw new AiRuntimeError(
        "Cloud inference is disabled (features.cloudProviders=false).",
        { code: "cloud_disabled" },
      );
    }
    return;
  }

  if (!context.offlineMode) {
    return;
  }

  if (operation === "model_install_url") {
    throw new AiRuntimeError(
      "URL model install is blocked while offline mode is enabled. " +
        "Use a local file path, or set ATLAS_FEATURE_OFFLINE_MODE=false.",
      { code: "offline_blocked" },
    );
  }

  if (operation === "web_api") {
    throw new AiRuntimeError(
      "External web API calls are blocked while offline mode is enabled.",
      { code: "offline_blocked" },
    );
  }
}

export function blockedOperationsWhenOffline(
  offlineMode: boolean,
): OfflineBlockedOperation[] {
  if (!offlineMode) {
    return [];
  }
  return ["model_install_url", "cloud_inference", "web_api"];
}
