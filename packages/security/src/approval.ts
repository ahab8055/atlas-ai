/**
 * Approval workflow foundation for sensitive operations.
 * UI / IPC prompts come later; this tracks pending decisions in-process.
 */

import { randomUUID } from "node:crypto";

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
  status: ApprovalStatus;
}

export interface ApprovalResult {
  id: string;
  status: Exclude<ApprovalStatus, "pending">;
  decidedAt: string;
  /** Optional user note. */
  note?: string;
}

/**
 * Build an approval request payload for the future Permission Center UI.
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
    status: "pending",
  };
}

export function isActionBlocked(evaluation: PermissionEvaluation): boolean {
  return evaluation.requiresUserAction || !evaluation.granted;
}

/**
 * Tracks pending approvals and resolves them (approve / deny / cancel).
 */
export class ApprovalWorkflow {
  private readonly pending = new Map<string, ApprovalRequest>();
  private readonly resolved = new Map<string, ApprovalResult>();

  create(
    request: PermissionRequest,
    evaluation: PermissionEvaluation,
    id: string = randomUUID(),
  ): ApprovalRequest {
    const approval = createApprovalRequest(id, request, evaluation);
    this.pending.set(approval.id, approval);
    return approval;
  }

  get(id: string): ApprovalRequest | undefined {
    return this.pending.get(id);
  }

  listPending(): ApprovalRequest[] {
    return [...this.pending.values()];
  }

  resolve(
    id: string,
    status: Exclude<ApprovalStatus, "pending">,
    note?: string,
  ): ApprovalResult | undefined {
    const approval = this.pending.get(id);
    if (!approval) {
      return undefined;
    }
    this.pending.delete(id);
    approval.status = status;
    const result: ApprovalResult = {
      id,
      status,
      decidedAt: new Date().toISOString(),
      note,
    };
    this.resolved.set(id, result);
    return result;
  }

  getResult(id: string): ApprovalResult | undefined {
    return this.resolved.get(id);
  }
}
