import { describe, expect, it } from "vitest";

import {
  ApprovalWorkflow,
  PermissionDecisionLog,
  PermissionManager,
  createApprovalRequest,
  evaluatePermission,
  isActionBlocked,
  requestPermission,
  setDefaultPermissionManager,
  tierForLevel,
} from "./index.js";

describe("permission tiers", () => {
  it("maps architecture levels to product tiers", () => {
    expect(tierForLevel(0)).toBe("read_only");
    expect(tierForLevel(1)).toBe("read_only");
    expect(tierForLevel(2)).toBe("user_approval_required");
    expect(tierForLevel(3)).toBe("user_approval_required");
  });
});

describe("PermissionManager", () => {
  it("allows reading files after grant (Read Only → Trusted Execution)", () => {
    const manager = new PermissionManager();

    const before = manager.requestPermission({
      capability: "filesystem.read",
      reason: "Search project files",
      resource: "~/Projects",
    });
    expect(before.blocked).toBe(true);
    expect(before.tier).toBe("read_only");
    expect(before.approval).toBeDefined();

    const resolved = manager.resolveApproval(before.approval!.id, "approved");
    expect(resolved?.status).toBe("approved");

    const after = manager.requestPermission({
      capability: "filesystem.read",
      reason: "Search project files",
      resource: "~/Projects",
    });
    expect(after.blocked).toBe(false);
    expect(after.tier).toBe("trusted_execution");
    expect(after.evaluation.decision).toBe("allow");
  });

  it("blocks deleting files until user approval (sensitive action)", () => {
    const manager = new PermissionManager();

    const check = manager.requestPermission({
      capability: "filesystem.delete",
      reason: "Remove obsolete build artifacts",
      resource: "/Projects/OldApp/dist",
    });

    expect(check.blocked).toBe(true);
    expect(check.tier).toBe("user_approval_required");
    expect(check.evaluation.decision).toBe("require_explicit_approval");
    expect(check.approval?.status).toBe("pending");
    expect(isActionBlocked(check.evaluation)).toBe(true);

    manager.resolveApproval(check.approval!.id, "denied", "too risky");

    const again = manager.requestPermission({
      capability: "filesystem.delete",
      reason: "Remove obsolete build artifacts",
    });
    expect(again.blocked).toBe(true);
  });

  it("records permission decisions", () => {
    const log = new PermissionDecisionLog({ maxRecords: 50 });
    const manager = new PermissionManager({ decisionLog: log });

    manager.requestPermission({
      capability: "system.info",
      reason: "status",
    });
    const blocked = manager.requestPermission({
      capability: "filesystem.delete",
      reason: "cleanup",
    });
    manager.resolveApproval(blocked.approval!.id, "approved");

    const decisions = manager.listDecisions();
    expect(decisions.length).toBe(3);
    expect(decisions[0]?.outcome).toBe("allowed");
    expect(decisions[1]?.outcome).toBe("blocked");
    expect(decisions[2]?.outcome).toBe("approved");
    expect(decisions[2]?.approvalId).toBe(blocked.approval?.id);
  });

  it("grants capability on approve so later delete can run as Trusted Execution", () => {
    const manager = new PermissionManager();
    const first = manager.requestPermission({
      capability: "filesystem.delete",
      reason: "cleanup",
    });
    expect(first.blocked).toBe(true);
    manager.resolveApproval(first.approval!.id, "approved");

    const second = manager.requestPermission({
      capability: "filesystem.delete",
      reason: "cleanup again",
    });
    expect(manager.getGrantedCapabilities().has("filesystem.delete")).toBe(
      true,
    );
    expect(second.blocked).toBe(false);
    expect(second.tier).toBe("trusted_execution");
  });
});

describe("ApprovalWorkflow", () => {
  it("tracks pending and resolved approvals", () => {
    const workflow = new ApprovalWorkflow();
    const evaluation = evaluatePermission({
      capability: "terminal.execute",
      reason: "npm test",
    });
    const approval = workflow.create(
      { capability: "terminal.execute", reason: "npm test" },
      evaluation,
      "apr_test",
    );
    expect(approval.status).toBe("pending");
    expect(workflow.listPending()).toHaveLength(1);

    const result = workflow.resolve("apr_test", "cancelled");
    expect(result?.status).toBe("cancelled");
    expect(workflow.listPending()).toHaveLength(0);
    expect(workflow.getResult("apr_test")?.status).toBe("cancelled");
  });
});

describe("createApprovalRequest", () => {
  it("builds a pending approval payload", () => {
    const evaluation = evaluatePermission({
      capability: "terminal.execute",
      reason: "npm test",
    });
    const approval = createApprovalRequest(
      "apr_1",
      {
        capability: "terminal.execute",
        reason: "npm test",
      },
      evaluation,
    );

    expect(approval.id).toBe("apr_1");
    expect(approval.status).toBe("pending");
    expect(approval.summary).toContain("terminal.execute");
    expect(approval.evaluation.requiresUserAction).toBe(true);
  });
});

describe("requestPermission (default manager)", () => {
  it("is callable as a package-level helper", () => {
    setDefaultPermissionManager(new PermissionManager());
    const check = requestPermission({
      capability: "system.info",
      reason: "ping",
    });
    expect(check.blocked).toBe(false);
    expect(check.tier).toBe("read_only");
  });
});
