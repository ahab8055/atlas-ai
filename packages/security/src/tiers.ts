import type { PermissionLevel } from "./permissions.js";

/**
 * Product-facing permission tiers (user story).
 * Mapped onto Architecture/06 levels 0–3.
 */
export type PermissionTier =
  "read_only" | "user_approval_required" | "trusted_execution";

export const PERMISSION_TIER_LABELS: Record<PermissionTier, string> = {
  read_only: "Read Only",
  user_approval_required: "User Approval Required",
  trusted_execution: "Trusted Execution",
};

/**
 * Map architecture levels to story tiers.
 * - Levels 0–1 → Read Only (public / user data; L1 still needs a grant first)
 * - Levels 2–3 → User Approval Required (confirm / explicit approve)
 * Trusted Execution is applied at decision time when a capability was already granted.
 */
export function tierForLevel(level: PermissionLevel): PermissionTier {
  if (level <= 1) {
    return "read_only";
  }
  return "user_approval_required";
}

export function isSensitiveTier(tier: PermissionTier): boolean {
  return tier === "user_approval_required";
}
