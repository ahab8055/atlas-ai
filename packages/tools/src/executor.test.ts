import { describe, expect, it } from "vitest";
import { PermissionManager } from "@atlas-ai/security";

import {
  executeTool,
  getDefaultToolExecutor,
  getDefaultToolRegistry,
  ToolExecutor,
  ToolRegistry,
} from "./index.js";

describe("tool execution framework", () => {
  it("executes a registered tool and returns output to the caller", () => {
    const result = executeTool({
      name: "echo",
      input: { text: "hello atlas" },
      context: { source: "cli" },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("completed");
    expect(result.toolName).toBe("echo");
    expect(result.toolVersion).toBe("1.0.0");
    expect(result.message).toBe("hello atlas");
    expect(result.data).toEqual({ text: "hello atlas" });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
  });

  it("validates inputs before execution", () => {
    const result = executeTool({
      name: "echo",
      input: {},
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("invalid_input");
    expect(result.errorCode).toBe("invalid_input");
    expect(result.validationErrors?.some((e) => e.includes("text"))).toBe(true);
  });

  it("handles unknown tools without throwing", () => {
    const result = executeTool({
      name: "does.not.exist",
      input: {},
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("not_found");
    expect(result.errorCode).toBe("not_found");
    expect(result.error).toContain("Unknown tool");
  });

  it("captures handler errors as failed executions", () => {
    const registry = new ToolRegistry();
    registry.register(
      {
        name: "demo.boom",
        description: "throws",
        version: "1.0.0",
        permissions: [],
        risk: "low",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
      () => {
        throw new Error("boom");
      },
    );
    const executor = new ToolExecutor(registry);

    const result = executor.execute({
      name: "demo.boom",
      input: {},
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.errorCode).toBe("handler_error");
    expect(result.error).toContain("boom");
  });

  it("captures handler-returned failures", () => {
    const registry = new ToolRegistry();
    registry.register(
      {
        name: "demo.fail",
        description: "always fails",
        version: "1.0.0",
        permissions: [],
        risk: "low",
        inputSchema: { type: "object" },
        outputSchema: { type: "object" },
      },
      () => ({ ok: false, error: "soft fail" }),
    );
    const executor = new ToolExecutor(registry);

    const result = executor.execute({ name: "demo.fail", input: {} });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.error).toBe("soft fail");
  });

  it("denies execution when checkPermissions is enabled", () => {
    const executor = new ToolExecutor(getDefaultToolRegistry(), {
      permissions: new PermissionManager(),
    });
    const result = executor.execute({
      name: "application.open",
      input: { application: "VS Code" },
      checkPermissions: true,
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("permission_denied");
    expect(result.errorCode).toBe("permission_denied");
    expect(result.permission?.requiresUserAction).toBe(true);
  });

  it("records executions in history for monitoring", () => {
    const executor = getDefaultToolExecutor();
    executor.clearHistory();
    executor.execute({ name: "echo", input: { text: "a" } });
    executor.execute({ name: "echo", input: {} });

    const history = executor.getHistory();
    expect(history).toHaveLength(2);
    expect(history[0]?.ok).toBe(true);
    expect(history[1]?.status).toBe("invalid_input");
  });
});
