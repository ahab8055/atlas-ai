import { createLogger, type LogRecord } from "@atlas-ai/logging";
import { describe, expect, it } from "vitest";

import {
  AtlasError,
  classifyCategory,
  createAtlasError,
  ErrorHandler,
  fromUnknown,
  handleError,
  markRecoveryAttempted,
  suggestRecovery,
} from "./index.js";

describe("error classification", () => {
  it("maps codes to User / Tool / System / AI categories", () => {
    expect(classifyCategory("permission_blocked", "x")).toBe("user");
    expect(classifyCategory("unknown_intent", "x")).toBe("user");
    expect(classifyCategory("tool_failed", "x")).toBe("tool");
    expect(classifyCategory("model_failed", "x")).toBe("ai");
    expect(classifyCategory("system_error", "boom")).toBe("system");
  });

  it("builds consistent AtlasErrorResponse structure", () => {
    const error = createAtlasError({
      category: "tool",
      code: "tool_failed",
      message: "disk full",
      traceId: "trace-1",
    });

    expect(error.id).toMatch(/^err_/);
    expect(error.category).toBe("tool");
    expect(error.code).toBe("tool_failed");
    expect(error.message).toBe("disk full");
    expect(error.userMessage).toMatch(/tool/i);
    expect(error.userMessage).toContain("disk full");
    expect(error.recoverable).toBe(true);
    expect(error.recovery.length).toBeGreaterThan(0);
    expect(error.traceId).toBe("trace-1");
    expect(error.timestamp).toBeTruthy();
  });

  it("suggests recovery strategies per category", () => {
    expect(suggestRecovery("user", "permission_blocked")[0]?.strategy).toBe(
      "ask_user",
    );
    expect(
      suggestRecovery("tool", "tool_failed").map((a) => a.strategy),
    ).toContain("retry");
    expect(suggestRecovery("system", "system_error")[0]?.strategy).toBe(
      "notify",
    );
  });

  it("marks recovery attempts", () => {
    const actions = suggestRecovery("tool", "tool_failed");
    const marked = markRecoveryAttempted(actions, "retry", false);
    expect(marked.find((a) => a.strategy === "retry")?.attempted).toBe(true);
    expect(marked.find((a) => a.strategy === "retry")?.succeeded).toBe(false);
  });
});

describe("ErrorHandler", () => {
  it("classifies unknown throws and logs them", () => {
    const records: LogRecord[] = [];
    const logger = createLogger({
      service: "test-errors",
      level: "debug",
      sink: { write: (r) => records.push(r) },
    });
    const handler = new ErrorHandler(logger);

    const response = handler.handle(new Error("unexpected boom"), {
      traceId: "t-9",
      category: "system",
      code: "pipeline_error",
    });

    expect(response.category).toBe("system");
    expect(response.userMessage).toMatch(/Something went wrong/i);
    expect(records.some((r) => r.level === "error")).toBe(true);
    expect(records[0]?.context?.errorCode).toBe("pipeline_error");
    expect(records[0]?.traceId).toBe("t-9");
  });

  it("exposes AtlasError helpers and fromUnknown", () => {
    const tool = AtlasError.tool("no such file");
    expect(tool.category).toBe("tool");
    expect(fromUnknown(tool).code).toBe("tool_failed");
    expect(handleError("plain string", { log: false }).message).toBe(
      "plain string",
    );
  });
});
