import { randomUUID } from "node:crypto";

import {
  ApprovalWorkflow,
  isActionBlocked,
  type ApprovalRequest,
  type ApprovalResult,
  type ApprovalStatus,
} from "./approval.js";
import {
  PermissionDecisionLog,
  type PermissionDecisionOutcome,
  type PermissionDecisionRecord,
} from "./audit.js";
import type {
  PermissionCapability,
  PermissionEvaluation,
  PermissionRequest,
} from "./permissions.js";
import { evaluatePermission } from "./policy.js";
import {
  PERMISSION_TIER_LABELS,
  tierForLevel,
  type PermissionTier,
} from "./tiers.js";

export interface PermissionCheckResult {
  evaluation: PermissionEvaluation;
  tier: PermissionTier;
  tierLabel: string;
  /** True when the action must not run yet. */
  blocked: boolean;
  /** Present when user action is required. */
  approval?: ApprovalRequest;
  /** Audit record id for this check. */
  decisionId: string;
}

export interface PermissionManagerOptions {
  grantedCapabilities?: Iterable<PermissionCapability>;
  decisionLog?: PermissionDecisionLog;
  approvalWorkflow?: ApprovalWorkflow;
}

/**
 * Permission checking layer — request, record, approve/deny, block sensitive actions.
 */
export class PermissionManager {
  private readonly granted = new Set<PermissionCapability>();
  readonly decisions: PermissionDecisionLog;
  readonly approvals: ApprovalWorkflow;

  constructor(options: PermissionManagerOptions = {}) {
    for (const capability of options.grantedCapabilities ?? []) {
      this.granted.add(capability);
    }
    this.decisions = options.decisionLog ?? new PermissionDecisionLog();
    this.approvals = options.approvalWorkflow ?? new ApprovalWorkflow();
  }

  getGrantedCapabilities(): ReadonlySet<PermissionCapability> {
    return this.granted;
  }

  grant(capability: PermissionCapability): void {
    this.granted.add(capability);
  }

  revoke(capability: PermissionCapability): void {
    this.granted.delete(capability);
  }

  /**
   * Primary API for actions/tools: request permission, record decision, open approval if needed.
   */
  requestPermission(
    request: PermissionRequest,
    options: { additionalGrants?: Iterable<PermissionCapability> } = {},
  ): PermissionCheckResult {
    const effective = new Set(this.granted);
    for (const capability of options.additionalGrants ?? []) {
      effective.add(capability);
    }

    const evaluation = evaluatePermission(request, effective);
    const blocked = isActionBlocked(evaluation);

    let tier = tierForLevel(evaluation.level);
    if (
      evaluation.granted &&
      !evaluation.requiresUserAction &&
      evaluation.level >= 1
    ) {
      tier = "trusted_execution";
    }

    let approval: ApprovalRequest | undefined;
    if (blocked) {
      approval = this.approvals.create(request, evaluation);
    }

    const outcome: PermissionDecisionOutcome = blocked ? "blocked" : "allowed";
    const decisionId = this.record({
      request,
      evaluation,
      tier,
      outcome,
      approvalId: approval?.id,
    });

    return {
      evaluation,
      tier,
      tierLabel: PERMISSION_TIER_LABELS[tier],
      blocked,
      approval,
      decisionId,
    };
  }

  /**
   * Resolve a pending approval. Approving Level-1 grants for trusted later runs;
   * Level 2/3 session grants also unlock subsequent checks for that capability.
   */
  resolveApproval(
    approvalId: string,
    status: Exclude<ApprovalStatus, "pending">,
    note?: string,
  ): ApprovalResult | undefined {
    const pending = this.approvals.get(approvalId);
    const result = this.approvals.resolve(approvalId, status, note);
    if (!result || !pending) {
      return result;
    }

    if (status === "approved") {
      this.grant(pending.request.capability);
    }

    const outcome: PermissionDecisionOutcome =
      status === "approved"
        ? "approved"
        : status === "denied"
          ? "denied"
          : "cancelled";

    this.record({
      request: pending.request,
      evaluation: pending.evaluation,
      tier:
        status === "approved" && pending.evaluation.level >= 1
          ? "trusted_execution"
          : tierForLevel(pending.evaluation.level),
      outcome,
      approvalId,
      note,
    });

    return result;
  }

  /** Convenience: whether a capability would be blocked right now. */
  wouldBlock(request: PermissionRequest): boolean {
    return isActionBlocked(evaluatePermission(request, this.granted));
  }

  listDecisions(): readonly PermissionDecisionRecord[] {
    return this.decisions.list();
  }

  private record(input: {
    request: PermissionRequest;
    evaluation: PermissionEvaluation;
    tier: PermissionTier;
    outcome: PermissionDecisionOutcome;
    approvalId?: string;
    note?: string;
  }): string {
    const id = randomUUID();
    this.decisions.append({
      id,
      at: new Date().toISOString(),
      request: input.request,
      evaluation: input.evaluation,
      tier: input.tier,
      tierLabel: PERMISSION_TIER_LABELS[input.tier],
      outcome: input.outcome,
      approvalId: input.approvalId,
      note: input.note,
    });
    return id;
  }
}

let defaultManager: PermissionManager | undefined;

export function getDefaultPermissionManager(): PermissionManager {
  defaultManager ??= new PermissionManager();
  return defaultManager;
}

export function setDefaultPermissionManager(manager: PermissionManager): void {
  defaultManager = manager;
}

/** Convenience wrapper around the default manager. */
export function requestPermission(
  request: PermissionRequest,
): PermissionCheckResult {
  return getDefaultPermissionManager().requestPermission(request);
}
