/**
 * Offline mode status types (Architecture/09, NFR-OFFLINE).
 */

export type InternetReachability = "true" | "false" | "unknown";

/** Network ops gated by offline policy. */
export type OfflineBlockedOperation =
  "model_install_url" | "cloud_inference" | "web_api";

export interface OfflineModeStatus {
  /** Configured offline policy (`features.offlineMode`). */
  offlineMode: boolean;
  /** Soft probe result for display only. */
  internetReachable: InternetReachability;
  /** Local inference provider reported healthy. */
  localInferenceReady: boolean;
  /** Active provider id (mock / llamacpp / …). */
  providerId?: string;
  /** Whether cloud providers feature flag is on. */
  cloudProvidersEnabled: boolean;
  /** Ops blocked while offlineMode is on. */
  blockedOperations: OfflineBlockedOperation[];
  /** Human-readable offline limitations. */
  limitations: string[];
  checkedAt: string;
}

export interface AssessOfflineCapabilityInput {
  offlineMode: boolean;
  cloudProvidersEnabled: boolean;
  /** Provider health ok (local path). */
  localInferenceReady: boolean;
  providerId?: string;
  internetReachable?: InternetReachability;
  now?: () => number;
}
