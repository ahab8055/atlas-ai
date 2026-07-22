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

/** Options for resolveApproval (string note still accepted for compat). */
export interface ResolveApprovalOptions {
  /** When true (default), approve also grants the capability for the session. */
  sessionGrant?: boolean;
  note?: string;
}

interface OneShotAllow {
  capability: PermissionCapability;
  resource?: string;
  reason: string;
  approvalId: string;
}

function oneShotKey(
  capability: PermissionCapability,
  resource?: string,
  reason?: string,
): string {
  return `${capability}\0${resource ?? ""}\0${reason ?? ""}`;
}

function normalizeResolveOptions(
  noteOrOptions?: string | ResolveApprovalOptions,
): ResolveApprovalOptions {
  if (typeof noteOrOptions === "string") {
    return { note: noteOrOptions, sessionGrant: true };
  }
  return {
    sessionGrant: noteOrOptions?.sessionGrant !== false,
    note: noteOrOptions?.note,
  };
}

/**
 * Permission checking layer — request, record, approve/deny, block sensitive actions.
 */
export class PermissionManager {
  private readonly granted = new Set<PermissionCapability>();
  private readonly oneShots = new Map<string, OneShotAllow>();
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
   * Consumes a matching one-shot allow (from resolveApproval with sessionGrant: false) if present.
   */
  requestPermission(
    request: PermissionRequest,
    options: { additionalGrants?: Iterable<PermissionCapability> } = {},
  ): PermissionCheckResult {
    const shotKey = oneShotKey(
      request.capability,
      request.resource,
      request.reason,
    );
    const oneShot = this.oneShots.get(shotKey);
    if (oneShot) {
      this.oneShots.delete(shotKey);
      const evaluation: PermissionEvaluation = {
        level: evaluatePermission(request, this.granted).level,
        decision: "allow",
        granted: true,
        requiresUserAction: false,
        message: `One-shot approval for ${request.capability} (approval ${oneShot.approvalId}).`,
      };
      const tier: PermissionTier = "trusted_execution";
      const decisionId = this.record({
        request,
        evaluation,
        tier,
        outcome: "allowed",
        approvalId: oneShot.approvalId,
      });
      return {
        evaluation,
        tier,
        tierLabel: PERMISSION_TIER_LABELS[tier],
        blocked: false,
        decisionId,
      };
    }

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
   * Resolve a pending approval.
   * Default sessionGrant: true grants the capability for later trusted runs.
   * sessionGrant: false records a one-shot allow (capability+resource+reason) only.
   */
  resolveApproval(
    approvalId: string,
    status: Exclude<ApprovalStatus, "pending">,
    noteOrOptions?: string | ResolveApprovalOptions,
  ): ApprovalResult | undefined {
    const opts = normalizeResolveOptions(noteOrOptions);
    const pending = this.approvals.get(approvalId);
    const result = this.approvals.resolve(approvalId, status, opts.note);
    if (!result || !pending) {
      return result;
    }

    if (status === "approved") {
      if (opts.sessionGrant !== false) {
        this.grant(pending.request.capability);
      } else {
        const caps = new Set<PermissionCapability>([
          pending.request.capability,
        ]);
        const reason = pending.request.reason;
        if (
          reason === "restorePath" ||
          reason === "renamePath" ||
          reason.startsWith("movePath")
        ) {
          caps.add("filesystem.write");
          caps.add("filesystem.delete");
        }
        for (const capability of caps) {
          this.oneShots.set(
            oneShotKey(
              capability,
              pending.request.resource,
              pending.request.reason,
            ),
            {
              capability,
              resource: pending.request.resource,
              reason: pending.request.reason,
              approvalId,
            },
          );
        }
      }
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
      note: opts.note,
    });

    return result;
  }

  /** Convenience: whether a capability would be blocked right now. */
  wouldBlock(request: PermissionRequest): boolean {
    const shotKey = oneShotKey(
      request.capability,
      request.resource,
      request.reason,
    );
    if (this.oneShots.has(shotKey)) {
      return false;
    }
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
