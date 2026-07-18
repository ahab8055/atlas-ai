import { describe, expect, it } from "vitest";
import {
  createApprovalRequest,
  evaluatePermission,
  isActionBlocked,
  classifyData,
  isSensitiveFieldName,
  MemorySecureStorage,
} from "./index.js";

describe("evaluatePermission", () => {
  it("allows level 0 system info without approval", () => {
    const result = evaluatePermission({
      capability: "system.info",
      reason: "show clock",
    });
    expect(result.level).toBe(0);
    expect(result.decision).toBe("allow");
    expect(result.requiresUserAction).toBe(false);
    expect(isActionBlocked(result)).toBe(false);
  });

  it("requires grant for filesystem.read when not granted", () => {
    const result = evaluatePermission({
      capability: "filesystem.read",
      reason: "search notes",
      resource: "~/Documents",
    });
    expect(result.level).toBe(1);
    expect(result.decision).toBe("require_grant");
    expect(isActionBlocked(result)).toBe(true);
  });

  it("allows filesystem.read when previously granted", () => {
    const result = evaluatePermission(
      { capability: "filesystem.read", reason: "search notes" },
      new Set(["filesystem.read"]),
    );
    expect(result.decision).toBe("allow");
    expect(result.granted).toBe(true);
  });

  it("requires confirmation for terminal.execute", () => {
    const result = evaluatePermission({
      capability: "terminal.execute",
      reason: "run tests",
    });
    expect(result.level).toBe(2);
    expect(result.decision).toBe("require_confirmation");
  });

  it("requires explicit approval for delete / install", () => {
    const del = evaluatePermission({
      capability: "filesystem.delete",
      reason: "remove old project",
    });
    expect(del.level).toBe(3);
    expect(del.decision).toBe("require_explicit_approval");

    const install = evaluatePermission({
      capability: "software.install",
      reason: "install cli",
    });
    expect(install.decision).toBe("require_explicit_approval");
  });

  it("maps memory capabilities to levels 1–3", () => {
    expect(
      evaluatePermission({
        capability: "memory.read",
        reason: "retrieve",
      }).level,
    ).toBe(1);
    expect(
      evaluatePermission({
        capability: "memory.write",
        reason: "store",
      }).level,
    ).toBe(2);
    expect(
      evaluatePermission({
        capability: "memory.delete",
        reason: "secure delete",
      }).decision,
    ).toBe("require_explicit_approval");
  });

  it("allows critical ops under Trusted Execution after grant", () => {
    const del = evaluatePermission(
      { capability: "filesystem.delete", reason: "cleanup" },
      new Set(["filesystem.delete"]),
    );
    expect(del.decision).toBe("allow");
    expect(del.granted).toBe(true);
    expect(isActionBlocked(del)).toBe(false);
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

describe("data handling", () => {
  it("classifies sensitive data as keychain-only", () => {
    const c = classifyData("sensitive");
    expect(c.requiresSecureStorage).toBe(true);
    expect(c.redactInLogs).toBe(true);
    expect(c.mayPersist).toBe(false);
  });

  it("detects sensitive field names", () => {
    expect(isSensitiveFieldName("apiKey")).toBe(true);
    expect(isSensitiveFieldName("userName")).toBe(false);
  });
});

describe("MemorySecureStorage", () => {
  it("stores and retrieves test secrets in memory", async () => {
    const storage = new MemorySecureStorage();
    const ref = { id: "test.key", kind: "api_key" as const };
    await storage.setSecret(ref, "sk-test");
    expect(await storage.getSecret(ref)).toBe("sk-test");
    await storage.deleteSecret(ref);
    expect(await storage.getSecret(ref)).toBeUndefined();
  });
});
