import { describe, expect, it } from "vitest";
import { PermissionManager } from "@atlas-ai/security";

import { ContextManager, loadContext } from "../context/index.js";
import { detectIntent } from "../intent/detect.js";
import { normalizeRequest } from "../normalize.js";
import { createPlan, draftStep, finalizePlan } from "../planning/index.js";
import { ExecutionController, executePlan } from "./index.js";

describe("execution controller", () => {
  it("runs the lifecycle pending → running → completed", () => {
    const controller = new ExecutionController(new PermissionManager());
    const states: string[] = [];
    const plan = finalizePlan({
      goal: "Echo pair",
      intentName: "demo",
      steps: [
        draftStep("a", "A", { tool: "echo", args: { text: "a" } }),
        draftStep("b", "B", { tool: "echo", args: { text: "b" } }),
      ],
      requiresApproval: false,
    });
    const request = normalizeRequest({ source: "cli", rawInput: "demo" });

    const result = controller.execute(request, plan, {
      onProgress: (task) => {
        states.push(task.state);
      },
    });

    expect(states[0]).toBe("running");
    expect(result.lifecycle).toBe("completed");
    expect(result.status).toBe("completed");
    expect(result.progress.percent).toBe(100);
    expect(result.progress.completedSteps).toBe(2);
    expect(result.failures).toEqual([]);
    expect(result.taskId).toBeTruthy();

    const stored = controller.getTask(result.taskId);
    expect(stored?.state).toBe("completed");
  });

  it("tracks progress and captures permission failures", () => {
    const controller = new ExecutionController(new PermissionManager());
    const request = normalizeRequest({
      source: "cli",
      rawInput: "Prepare my development environment",
    });
    const intent = detectIntent(request);
    const context = loadContext(request, intent, {
      manager: new ContextManager(),
    });
    const plan = createPlan(request, intent, context);

    const percents: number[] = [];
    const result = controller.execute(request, plan, {
      onProgress: (task) => {
        percents.push(task.progress.percent);
      },
    });

    expect(result.lifecycle).toBe("failed");
    expect(result.status).toBe("blocked");
    expect(result.failures.length).toBeGreaterThan(0);
    expect(result.failures[0]?.code).toBe("permission_blocked");
    expect(result.failures[0]?.message).toContain("Permission");
    expect(result.progress.blockedSteps).toBe(1);
    expect(result.progress.skippedSteps).toBe(3);
    expect(percents.length).toBeGreaterThan(0);

    const monitored = controller.getTask(result.taskId);
    expect(monitored?.failures[0]?.code).toBe("permission_blocked");
  });

  it("supports cancellation between steps", () => {
    const controller = new ExecutionController(new PermissionManager());
    const plan = finalizePlan({
      goal: "Cancel mid-way",
      intentName: "demo",
      steps: [
        draftStep("a", "A", { tool: "echo", args: { text: "a" } }),
        draftStep("b", "B", { tool: "echo", args: { text: "b" } }),
        draftStep("c", "C", { tool: "echo", args: { text: "c" } }),
      ],
      requiresApproval: false,
    });
    const request = normalizeRequest({ source: "cli", rawInput: "demo" });

    const result = controller.execute(request, plan, {
      beforeStep: (_task, stepId) => stepId !== "b",
    });

    expect(result.lifecycle).toBe("cancelled");
    expect(result.status).toBe("cancelled");
    expect(result.steps[0]?.status).toBe("completed");
    expect(result.steps[1]?.status).toBe("cancelled");
    expect(result.steps[2]?.status).toBe("cancelled");
    expect(result.failures.some((f) => f.code === "cancelled")).toBe(true);
  });

  it("cancels a pending task before run", () => {
    const controller = new ExecutionController(new PermissionManager());
    const plan = finalizePlan({
      goal: "Never run",
      intentName: "demo",
      steps: [draftStep("a", "A", { tool: "echo", args: { text: "a" } })],
      requiresApproval: false,
    });
    const request = normalizeRequest({ source: "cli", rawInput: "demo" });
    const task = controller.createTask(request, plan);

    expect(task.state).toBe("pending");
    expect(controller.cancel(task.id)).toBe(true);

    const cancelled = controller.getTask(task.id);
    expect(cancelled?.state).toBe("cancelled");
    expect(cancelled?.failures[0]?.code).toBe("cancelled");
  });

  it("executePlan delegates to the controller", () => {
    const controller = new ExecutionController(new PermissionManager());
    const plan = finalizePlan({
      goal: "Echo",
      intentName: "echo",
      steps: [
        draftStep("echo", "Echo", {
          tool: "echo",
          args: { text: "hello" },
        }),
      ],
      requiresApproval: false,
    });
    const result = executePlan(
      normalizeRequest({ source: "cli", rawInput: "echo hello" }),
      plan,
      { controller },
    );
    expect(result.status).toBe("completed");
    expect(result.steps[0]?.output).toBe("hello");
    expect(controller.listTasks()).toHaveLength(1);
  });
});
