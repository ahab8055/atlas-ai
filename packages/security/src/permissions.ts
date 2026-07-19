/**
 * Capability-based permissions (Architecture/06-Security-Architecture.md).
 */

/** Permission levels 0–3 from Security Architecture. */
export type PermissionLevel = 0 | 1 | 2 | 3;

/**
 * Named capabilities Atlas may request.
 * Extend as tools/agents land — do not grant by default.
 */
export type PermissionCapability =
  | "system.info"
  | "filesystem.read"
  | "filesystem.write"
  | "filesystem.delete"
  | "terminal.execute"
  | "browser.access"
  | "application.control"
  | "network.access"
  | "settings.change"
  | "software.install"
  | "memory.read"
  | "memory.write"
  | "memory.delete"
  | "clipboard.read"
  | "clipboard.write"
  | "notifications.show";

export type ApprovalDecision =
  | "allow"
  | "deny"
  | "require_grant"
  | "require_confirmation"
  | "require_explicit_approval";

export interface PermissionRequest {
  capability: PermissionCapability;
  /** Human-readable intent for transparency. */
  reason: string;
  /** Optional resource path / target (never log secrets). */
  resource?: string;
  agentId?: string;
}

export interface PermissionEvaluation {
  level: PermissionLevel;
  decision: ApprovalDecision;
  granted: boolean;
  requiresUserAction: boolean;
  message: string;
}

/** Risk labels used in policy explanation. */
export type RiskLevel = "low" | "medium" | "high" | "critical";
