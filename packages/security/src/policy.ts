import type {
  PermissionCapability,
  PermissionEvaluation,
  PermissionLevel,
  PermissionRequest,
  RiskLevel,
} from "./permissions.js";

/** Default level mapping for MVP capabilities. */
export const CAPABILITY_LEVELS: Record<PermissionCapability, PermissionLevel> =
  {
    "system.info": 0,
    "filesystem.read": 1,
    "filesystem.write": 2,
    "filesystem.delete": 3,
    "terminal.execute": 2,
    "browser.access": 1,
    "application.control": 2,
    "network.access": 2,
    "settings.change": 3,
    "software.install": 3,
    "memory.read": 1,
    "memory.write": 2,
    "memory.delete": 3,
  };

const LEVEL_RISK: Record<PermissionLevel, RiskLevel> = {
  0: "low",
  1: "medium",
  2: "high",
  3: "critical",
};

/**
 * Foundation policy evaluator.
 * Does not execute actions — only decides allow / grant / confirm / approve / deny.
 *
 * Flow (Security Architecture + Trusted Execution):
 * Level 0 → allow
 * Levels 1–3 with prior grant → allow (Trusted Execution)
 * Level 1 without grant → require prior grant
 * Level 2 without grant → require confirmation
 * Level 3 without grant → require explicit approval
 */
export function evaluatePermission(
  request: PermissionRequest,
  grantedCapabilities: ReadonlySet<PermissionCapability> = new Set(),
): PermissionEvaluation {
  const level = CAPABILITY_LEVELS[request.capability];
  const risk = LEVEL_RISK[level];
  const hasGrant = grantedCapabilities.has(request.capability);

  if (level === 0) {
    return {
      level,
      decision: "allow",
      granted: true,
      requiresUserAction: false,
      message: `Public/system info (${risk} risk): no approval required.`,
    };
  }

  if (hasGrant) {
    return {
      level,
      decision: "allow",
      granted: true,
      requiresUserAction: false,
      message: `Trusted execution for ${request.capability} (${risk} risk).`,
    };
  }

  if (level === 1) {
    return {
      level,
      decision: "require_grant",
      granted: false,
      requiresUserAction: true,
      message: `Grant permission for ${request.capability} before continuing. Reason: ${request.reason}`,
    };
  }

  if (level === 2) {
    return {
      level,
      decision: "require_confirmation",
      granted: false,
      requiresUserAction: true,
      message: `Confirm system action (${request.capability}). Reason: ${request.reason}`,
    };
  }

  // level === 3
  return {
    level,
    decision: "require_explicit_approval",
    granted: false,
    requiresUserAction: true,
    message: `Explicit approval required for critical operation (${request.capability}). Reason: ${request.reason}`,
  };
}

export function riskForCapability(capability: PermissionCapability): RiskLevel {
  return LEVEL_RISK[CAPABILITY_LEVELS[capability]];
}
