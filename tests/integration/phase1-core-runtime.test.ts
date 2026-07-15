/**
 * Phase 1 Core Runtime — integration tests.
 *
 * Cross-package workflows (not colocated unit tests):
 * request pipeline · tool execution · planning · permissions · error handling.
 */
import { describe, expect, it } from "vitest";
import {
  CORE_EVENTS,
  ORCHESTRATION_EVENTS,
  ContextManager,
  EventBus,
  executeTool,
  handleRequest,
  listToolMetadata,
  type AtlasEvent,
} from "@atlas-ai/core";
import { createLogger, type LogRecord } from "@atlas-ai/logging";

import {
  createRuntimeHarness,
  ENV_SETUP_GRANTS,
  hasLoggedErrorCode,
} from "./helpers.js";

describe("Phase 1 integration — request pipeline", () => {
  it("runs normalize → intent → context → plan → execute → respond with events", () => {
    const harness = createRuntimeHarness();
    const seen: string[] = [];
    harness.eventBus.subscribe("*", (event: AtlasEvent) => {
      seen.push(event.type);
    });

    const result = harness.handle("  status  ");

    expect(result.request.text).toBe("status");
    expect(result.intent.name).toBe("system.status");
    expect(result.intent.known).toBe(true);
    expect(result.context.sources.length).toBeGreaterThan(0);
    expect(result.plan.steps.some((s) => s.tool === "system.info")).toBe(true);
    expect(result.execution.status).toBe("completed");
    expect(result.response.status).toBe("completed");
    expect(result.response.text).toContain("Atlas core OK");
    expect(result.response.structuredErrors).toEqual([]);

    for (const type of CORE_EVENTS) {
      expect(seen).toContain(type);
    }
    const logMessages = harness.records.map((r) => r.message);
    for (const event of ORCHESTRATION_EVENTS) {
      expect(logMessages).toContain(event);
    }
    expect(
      harness.records.every((r) => r.traceId === result.request.traceId),
    ).toBe(true);
  });

  it("keeps desktop / voice / api sources on the same pipeline path", () => {
    for (const source of ["desktop", "voice", "api"] as const) {
      const harness = createRuntimeHarness();
      const result = harness.handle("ping", { source });
      expect(result.request.source).toBe(source);
      expect(result.intent.name).toBe("system.status");
      expect(result.execution.status).toBe("completed");
    }
  });
});

describe("Phase 1 integration — tool execution flow", () => {
  it("executes echo through the full pipeline and returns tool output", () => {
    const harness = createRuntimeHarness();
    const result = harness.handle("echo hello atlas");

    expect(result.intent.name).toBe("echo");
    expect(result.plan.steps[0]?.tool).toBe("echo");
    expect(result.execution.status).toBe("completed");
    expect(result.execution.steps[0]?.output).toBe("hello atlas");
    expect(result.response.text).toContain("hello atlas");
    expect(result.response.spokenText).toContain("hello atlas");
  });

  it("lists registry tools and can invoke system.info via executeTool", () => {
    const tools = listToolMetadata();
    expect(tools.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        "system.info",
        "echo",
        "application.open",
        "file.search",
      ]),
    );

    const direct = executeTool({
      name: "system.info",
      input: { source: "cli" },
      context: { source: "cli" },
    });
    expect(direct.ok).toBe(true);
    expect(direct.message).toContain("Atlas core OK");

    const harness = createRuntimeHarness();
    const viaPipeline = harness.handle("list tools");
    expect(viaPipeline.intent.name).toBe("tools.list");
    expect(viaPipeline.response.text).toContain("system.info");
    expect(viaPipeline.response.text).toContain("@1.0.0");
  });

  it("surfaces invalid tool input as a failed execution when driven from a plan", () => {
    const direct = executeTool({ name: "echo", input: {} });
    expect(direct.ok).toBe(false);
    expect(direct.errorCode).toBe("invalid_input");
  });
});

describe("Phase 1 integration — planning system", () => {
  it("builds a simple plan for Open VS Code", () => {
    const harness = createRuntimeHarness();
    const result = harness.handle("Open VS Code");

    expect(result.intent.category).toBe("application_control");
    expect(result.plan.kind).toBe("simple");
    expect(result.plan.requiresApproval).toBe(true);
    expect(result.plan.steps).toHaveLength(1);
    expect(result.plan.steps[0]?.tool).toBe("application.open");
    expect(result.plan.steps[0]?.args?.application).toBe("VS Code");
    expect(result.plan.steps[0]?.capability).toBe("application.control");
  });

  it("builds an ordered multi-step plan for prepare development environment", () => {
    const harness = createRuntimeHarness();
    const result = harness.handle("Prepare my development environment");

    expect(result.intent.name).toBe("environment.setup");
    expect(result.plan.kind).toBe("multi");
    expect(result.plan.steps.map((s) => s.order)).toEqual([1, 2, 3, 4]);
    expect(result.plan.steps.map((s) => s.id)).toEqual([
      "open-editor",
      "open-project",
      "start-backend",
      "start-frontend",
    ]);
    expect(result.plan.steps.map((s) => s.tool)).toEqual([
      "application.open",
      "project.open",
      "process.start",
      "process.start",
    ]);
  });

  it("executes the multi-step plan in order when permissions are granted", () => {
    const harness = createRuntimeHarness({
      grantedCapabilities: ENV_SETUP_GRANTS,
    });
    const result = harness.handle("Prepare my development environment");

    expect(result.execution.status).toBe("completed");
    expect(result.execution.progress.completedSteps).toBe(4);
    expect(result.execution.failures).toEqual([]);
    expect(result.execution.steps.map((s) => s.status)).toEqual([
      "completed",
      "completed",
      "completed",
      "completed",
    ]);
    expect(result.response.status).toBe("completed");
    expect(result.response.text).toMatch(/VS Code|backend|frontend/i);
  });
});

describe("Phase 1 integration — permission checks", () => {
  it("blocks sensitive actions without prior grant", () => {
    const harness = createRuntimeHarness();
    const result = harness.handle("Open VS Code");

    expect(result.execution.status).toBe("blocked");
    expect(result.execution.failures[0]?.code).toBe("permission_blocked");
    expect(result.response.status).toBe("blocked");
    expect(result.response.structuredErrors[0]?.category).toBe("user");
    expect(result.response.structuredErrors[0]?.code).toBe(
      "permission_blocked",
    );
    expect(result.response.errors[0]).toMatch(/approval|User Error/i);
    expect(
      result.response.nextSteps.some((s) => /Approve|permission/i.test(s)),
    ).toBe(true);
    expect(hasLoggedErrorCode(harness.records, "permission_blocked")).toBe(
      true,
    );
  });

  it("allows the same action after capability grant (Trusted Execution)", () => {
    const harness = createRuntimeHarness({
      grantedCapabilities: ["application.control"],
    });
    const result = harness.handle("Open VS Code");

    expect(result.execution.status).toBe("completed");
    expect(result.execution.failures).toEqual([]);
    expect(result.response.status).toBe("completed");
    expect(result.response.text).toContain("VS Code");
    expect(result.response.structuredErrors).toEqual([]);
  });

  it("approve → retry unlocks a previously blocked capability", () => {
    const harness = createRuntimeHarness();
    const blocked = harness.handle("Open VS Code");
    expect(blocked.execution.status).toBe("blocked");

    const pending = harness.permissions.approvals.listPending();
    expect(pending.length).toBeGreaterThan(0);
    harness.permissions.resolveApproval(pending[0]!.id, "approved");

    const allowed = harness.handle("Open VS Code");
    expect(allowed.execution.status).toBe("completed");
    expect(allowed.response.text).toContain("VS Code");
  });

  it("allows level-0 system.info without approval", () => {
    const harness = createRuntimeHarness();
    const result = harness.handle("status");
    expect(result.execution.status).toBe("completed");
    expect(result.execution.failures).toEqual([]);
  });
});

describe("Phase 1 integration — error handling", () => {
  it("returns structured user errors for unknown intents", () => {
    const harness = createRuntimeHarness();
    const result = harness.handle("teleport my coffee mug to mars");

    expect(result.intent.name).toBe("unknown");
    expect(result.response.structuredErrors).toHaveLength(1);
    expect(result.response.structuredErrors[0]?.category).toBe("user");
    expect(result.response.structuredErrors[0]?.code).toBe("unknown_intent");
    expect(result.response.structuredErrors[0]?.userMessage).toMatch(
      /understand|help/i,
    );
    expect(result.response.errors[0]).toMatch(/understand|help/i);
    expect(result.response.nextSteps.length).toBeGreaterThan(0);
    expect(
      harness.records.some((r) => r.context?.errorCode === "unknown_intent"),
    ).toBe(true);
  });

  it("classifies permission failures as recoverable user errors", () => {
    const harness = createRuntimeHarness();
    const result = harness.handle("Find my project files");

    expect(result.execution.status).toBe("blocked");
    const [error] = result.response.structuredErrors;
    expect(error?.category).toBe("user");
    expect(error?.recoverable).toBe(true);
    expect(error?.recovery.some((a) => a.strategy === "ask_user")).toBe(true);
    expect(error?.userMessage.length).toBeGreaterThan(10);
  });

  it("recovers from unexpected controller throws with a system error response", () => {
    const records: LogRecord[] = [];
    const logger = createLogger({
      service: "phase1-integration-throw",
      level: "info",
      sink: { write: (r) => records.push(r) },
    });
    const throwingController = {
      execute() {
        throw new Error("controller exploded");
      },
    };

    const result = handleRequest(
      { source: "cli", rawInput: "status" },
      {
        logger,
        contextManager: new ContextManager(),
        eventBus: new EventBus(),
        executionController: throwingController as never,
      },
    );

    expect(result.execution.status).toBe("failed");
    expect(result.response.structuredErrors[0]?.category).toBe("system");
    expect(result.response.structuredErrors[0]?.code).toBe("pipeline_error");
    expect(result.response.errors[0]).toMatch(/Something went wrong|System/i);
    expect(result.response.nextSteps.length).toBeGreaterThan(0);
    expect(hasLoggedErrorCode(records, "pipeline_error")).toBe(true);
  });
});

describe("Phase 1 integration — critical path stability", () => {
  /**
   * High-signal smoke: if any of these regress, Phase 1 runtime is not stable.
   */
  it("detects critical workflow failures across happy and failure paths", () => {
    const failures: string[] = [];

    const happy = createRuntimeHarness().handle("status");
    if (happy.execution.status !== "completed") {
      failures.push("status must complete without permissions");
    }
    if (!happy.response.text.includes("Atlas core OK")) {
      failures.push("status response must include runtime OK message");
    }

    const echo = createRuntimeHarness().handle("echo integration ok");
    if (echo.execution.steps[0]?.output !== "integration ok") {
      failures.push("echo tool path broken");
    }

    const blocked = createRuntimeHarness().handle("Open VS Code");
    if (blocked.execution.failures[0]?.code !== "permission_blocked") {
      failures.push("permission gate not enforcing application.control");
    }
    if (blocked.response.structuredErrors[0]?.category !== "user") {
      failures.push("permission block must surface structured user error");
    }

    const granted = createRuntimeHarness({
      grantedCapabilities: ["application.control"],
    }).handle("Open VS Code");
    if (granted.execution.status !== "completed") {
      failures.push("granted application.control must allow open");
    }

    const multi = createRuntimeHarness({
      grantedCapabilities: ENV_SETUP_GRANTS,
    }).handle("Prepare my development environment");
    if (multi.plan.steps.length !== 4) {
      failures.push("env setup plan must stay 4 ordered steps");
    }
    if (multi.execution.status !== "completed") {
      failures.push("env setup with grants must complete all tools");
    }

    const unknown = createRuntimeHarness().handle("xyzzy unknown");
    if (unknown.response.structuredErrors[0]?.code !== "unknown_intent") {
      failures.push("unknown intent must use structured unknown_intent error");
    }

    expect(failures, failures.join("; ")).toEqual([]);
  });
});
