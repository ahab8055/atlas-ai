/**
 * Sensitive data classification and handling rules
 * (Architecture/06 § Data Protection + Secrets Management).
 */

export type DataSensitivity = "public" | "personal" | "sensitive";

export interface DataClassification {
  sensitivity: DataSensitivity;
  /** May be persisted to local DB / files when encrypted appropriately. */
  mayPersist: boolean;
  /** Must use OS keychain (or equivalent) — never plaintext files / JSON config. */
  requiresSecureStorage: boolean;
  /** Must not appear in logs without redaction. */
  redactInLogs: boolean;
}

const CLASSIFICATIONS: Record<DataSensitivity, DataClassification> = {
  public: {
    sensitivity: "public",
    mayPersist: true,
    requiresSecureStorage: false,
    redactInLogs: false,
  },
  personal: {
    sensitivity: "personal",
    mayPersist: true,
    requiresSecureStorage: false,
    redactInLogs: true,
  },
  sensitive: {
    sensitivity: "sensitive",
    mayPersist: false,
    requiresSecureStorage: true,
    redactInLogs: true,
  },
};

export function classifyData(sensitivity: DataSensitivity): DataClassification {
  return CLASSIFICATIONS[sensitivity];
}

/** Heuristic helpers for common secret-shaped field names. */
const SENSITIVE_FIELD =
  /(pass(word)?|secret|token|api[_-]?key|authorization|credential|private[_-]?key)/i;

export function isSensitiveFieldName(field: string): boolean {
  return SENSITIVE_FIELD.test(field);
}

/**
 * Rules summary for implementers (also documented in guides/Security.md).
 */
export const SENSITIVE_DATA_RULES = [
  "Never store API keys, passwords, or tokens in source, config JSON, or VITE_* vars.",
  "MVP secret storage target: OS keychain (SecureStorageProvider).",
  "Personal documents: high protection — access via Level 1+ permissions.",
  "Sensitive credentials: critical protection — keychain only; always redact in logs.",
  "Prefer least privilege: request the lowest capability that satisfies the task.",
] as const;
