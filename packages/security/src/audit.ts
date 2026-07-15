import type { PermissionEvaluation, PermissionRequest } from "./permissions.js";
import type { PermissionTier } from "./tiers.js";

export type PermissionDecisionOutcome =
  "allowed" | "blocked" | "approved" | "denied" | "cancelled";

/** Immutable audit record — "Permission decisions are recorded." */
export interface PermissionDecisionRecord {
  id: string;
  at: string;
  request: PermissionRequest;
  evaluation: PermissionEvaluation;
  tier: PermissionTier;
  tierLabel: string;
  outcome: PermissionDecisionOutcome;
  approvalId?: string;
  note?: string;
}

export interface DecisionLogOptions {
  maxRecords?: number;
}

/**
 * In-memory decision audit trail (local-first; persist later).
 */
export class PermissionDecisionLog {
  private readonly records: PermissionDecisionRecord[] = [];
  private readonly maxRecords: number;

  constructor(options: DecisionLogOptions = {}) {
    this.maxRecords = options.maxRecords ?? 500;
  }

  append(record: PermissionDecisionRecord): void {
    this.records.push(record);
    while (this.records.length > this.maxRecords) {
      this.records.shift();
    }
  }

  list(): readonly PermissionDecisionRecord[] {
    return this.records;
  }

  clear(): void {
    this.records.length = 0;
  }

  findByApprovalId(approvalId: string): PermissionDecisionRecord | undefined {
    for (let i = this.records.length - 1; i >= 0; i -= 1) {
      const record = this.records[i];
      if (record?.approvalId === approvalId) {
        return record;
      }
    }
    return undefined;
  }
}
