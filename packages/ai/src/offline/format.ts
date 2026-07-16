/**
 * Format offline mode status for CLI.
 */
import type { OfflineModeStatus } from "./types.js";

export function formatOfflineModeStatus(status: OfflineModeStatus): string {
  const lines = [
    "Offline mode",
    `  Policy: ${status.offlineMode ? "ON (block internet AI ops)" : "OFF (URL install allowed)"}`,
    `  Internet reachable: ${status.internetReachable}`,
    `  Local inference ready: ${status.localInferenceReady ? "yes" : "no"}`,
    ...(status.providerId ? [`  Provider: ${status.providerId}`] : []),
    `  Cloud providers enabled: ${status.cloudProvidersEnabled ? "yes" : "no"}`,
    `  Blocked ops: ${
      status.blockedOperations.length > 0
        ? status.blockedOperations.join(", ")
        : "(none)"
    }`,
    "  Limitations:",
    ...status.limitations.slice(0, 6).map((l) => `    - ${l}`),
    `  Checked at: ${status.checkedAt}`,
  ];
  return lines.join("\n");
}
