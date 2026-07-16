export type {
  AssessOfflineCapabilityInput,
  InternetReachability,
  OfflineBlockedOperation,
  OfflineModeStatus,
} from "./types.js";

export {
  assertNetworkOperationAllowed,
  blockedOperationsWhenOffline,
  isLoopbackHostname,
  isLoopbackUrl,
  type NetworkOperation,
  type OfflinePolicyContext,
} from "./policy.js";

export { OFFLINE_LIMITATIONS, assessOfflineCapability } from "./assess.js";

export {
  probeInternetReachability,
  type ProbeInternetOptions,
} from "./probe.js";

export { formatOfflineModeStatus } from "./format.js";
