/**
 * Planned user approval flow for sensitive operations.
 * UI and IPC wiring come later; callers should still evaluate permissions first.
 */

import type { PermissionEvaluation, PermissionRequest } from "./permissions.js";

export type ApprovalStatus =
  "pending" | "approved" | "denied" | "cancelled" | "expired";

export interface ApprovalRequest {
  id: string;
  createdAt: string;
  request: PermissionRequest;
  evaluation: PermissionEvaluation;
  /** Explanation shown to the user (transparency principle). */
  summary: string;
}

export interface ApprovalResult {
  id: string;
  status: ApprovalStatus;
  decidedAt: string;
  /** Optional user note. */
  note?: string;
}

/**
 * Build an approval request payload for the future Permission Center UI.
 * Does not show UI — foundation for IPC + desktop prompts.
 */
export function createApprovalRequest(
  id: string,
  request: PermissionRequest,
  evaluation: PermissionEvaluation,
): ApprovalRequest {
  return {
    id,
    createdAt: new Date().toISOString(),
    request,
    evaluation,
    summary: evaluation.message,
  };
}

export function isActionBlocked(evaluation: PermissionEvaluation): boolean {
  return evaluation.requiresUserAction || !evaluation.granted;
}
