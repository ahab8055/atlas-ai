/**
 * Assess offline capability for status / CLI (Architecture/09).
 */
import { blockedOperationsWhenOffline } from "./policy.js";
import type {
  AssessOfflineCapabilityInput,
  OfflineModeStatus,
} from "./types.js";

export const OFFLINE_LIMITATIONS: readonly string[] = [
  "URL model downloads (http/https install) when offlineMode is on",
  "Cloud LLM providers (OpenAI/Anthropic) — optional and off by default",
  "External web search / web APIs",
  "Model marketplace / remote catalog",
  "Real STT/TTS engines (speech foundation uses mocks until wired)",
  "Telemetry / remote monitoring",
];

export function assessOfflineCapability(
  input: AssessOfflineCapabilityInput,
): OfflineModeStatus {
  const now = input.now ?? (() => Date.now());
  return {
    offlineMode: input.offlineMode,
    internetReachable: input.internetReachable ?? "unknown",
    localInferenceReady: input.localInferenceReady,
    providerId: input.providerId,
    cloudProvidersEnabled: input.cloudProvidersEnabled,
    blockedOperations: blockedOperationsWhenOffline(input.offlineMode),
    limitations: [...OFFLINE_LIMITATIONS],
    checkedAt: new Date(now()).toISOString(),
  };
}
