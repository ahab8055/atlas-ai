export type {
  ApprovalDecision,
  PermissionCapability,
  PermissionEvaluation,
  PermissionLevel,
  PermissionRequest,
  RiskLevel,
} from "./permissions.js";

export {
  CAPABILITY_LEVELS,
  evaluatePermission,
  riskForCapability,
} from "./policy.js";

export type {
  ApprovalRequest,
  ApprovalResult,
  ApprovalStatus,
} from "./approval.js";
export {
  ApprovalWorkflow,
  createApprovalRequest,
  isActionBlocked,
} from "./approval.js";

export type { PermissionTier } from "./tiers.js";
export {
  PERMISSION_TIER_LABELS,
  isSensitiveTier,
  tierForLevel,
} from "./tiers.js";

export type {
  PermissionDecisionOutcome,
  PermissionDecisionRecord,
} from "./audit.js";
export { PermissionDecisionLog } from "./audit.js";

export type {
  PermissionCheckResult,
  PermissionManagerOptions,
  ResolveApprovalOptions,
} from "./manager.js";
export {
  PermissionManager,
  getDefaultPermissionManager,
  requestPermission,
  setDefaultPermissionManager,
} from "./manager.js";

export type { DataClassification, DataSensitivity } from "./data.js";
export {
  SENSITIVE_DATA_RULES,
  classifyData,
  isSensitiveFieldName,
} from "./data.js";

export type {
  SecretKind,
  SecretRef,
  SecureStorageProvider,
} from "./storage.js";
export { MemorySecureStorage, UnconfiguredSecureStorage } from "./storage.js";

export type { AesGcmPayload } from "./crypto.js";
export {
  AES_GCM_IV_BYTES,
  AES_GCM_KEY_BYTES,
  MEMORY_DEK_SECRET_ID,
  decryptAesGcm,
  encryptAesGcm,
  generateAesGcmKey,
  keyFromBase64,
  keyToBase64,
} from "./crypto.js";
