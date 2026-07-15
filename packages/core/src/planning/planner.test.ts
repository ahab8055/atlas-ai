import { describe, expect, it } from "vitest";

import { ContextManager, loadContext } from "../context/index.js";
import { detectIntent } from "../intent/detect.js";
import { normalizeRequest } from "../normalize.js";
import { executePlan } from "../stages/execute.js";
import {
  createPlan,
  draftStep,
  finalizePlan,
  formatPlanSteps,
  PlanRegistry,
  registerPlanTemplate,
} from "./index.js";

describe("task planning engine", () => {
  it("generates a simple single-step plan for Open VS Code", () => {
    const manager = new ContextManager();
    const request = normalizeRequest({
      source: "cli",
      rawInput: "Open VS Code",
    });
    const intent = detectIntent(request);
    const context = loadContext(request, intent, { manager });
    const plan = createPlan(request, intent, context);

    expect(plan.kind).toBe("simple");
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]?.order).toBe(1);
    expect(plan.steps[0]?.tool).toBe("application.open");
    expect(plan.steps[0]?.args?.application).toBe("VS Code");
    expect(plan.requiresApproval).toBe(true);
  });

  it("generates an ordered multi-step plan for preparing the dev environment", () => {
    const manager = new ContextManager();
    const request = normalizeRequest({
      source: "cli",
      rawInput: "Prepare my development environment",
    });
    const intent = detectIntent(request);
    expect(intent.name).toBe("environment.setup");

    const context = loadContext(request, intent, { manager });
    const plan = createPlan(request, intent, context);

    expect(plan.kind).toBe("multi");
    expect(plan.goal).toContain("development environment");
    expect(plan.steps.map((s) => s.order)).toEqual([1, 2, 3, 4]);
    expect(plan.steps.map((s) => s.id)).toEqual([
      "open-editor",
      "open-project",
      "start-backend",
      "start-frontend",
    ]);
    expect(plan.steps.map((s) => s.tool)).toEqual([
      "application.open",
      "project.open",
      "process.start",
      "process.start",
    ]);
    expect(plan.steps[0]?.args?.application).toBe("VS Code");
    expect(plan.steps[1]?.args?.project).toBe("Atlas AI");
    expect(formatPlanSteps(plan)).toContain("1. Open VS Code");
    expect(formatPlanSteps(plan)).toContain("4. Start frontend service");
  });

  it("produces tool-system-ready steps that the executor can consume", () => {
    const plan = finalizePlan({
      goal: "Demo",
      intentName: "demo",
      steps: [
        draftStep("a", "Step A", { tool: "echo", args: { text: "a" } }),
        draftStep("b", "Step B", { tool: "echo", args: { text: "b" } }),
      ],
      requiresApproval: false,
    });

    const result = executePlan(
      normalizeRequest({ source: "cli", rawInput: "demo" }),
      plan,
    );

    expect(result.status).toBe("completed");
    expect(result.steps.map((s) => s.output)).toEqual(["a", "b"]);
  });

  it("skips later steps when an earlier required step is blocked", () => {
    const manager = new ContextManager();
    const request = normalizeRequest({
      source: "cli",
      rawInput: "Prepare my development environment",
    });
    const intent = detectIntent(request);
    const context = loadContext(request, intent, { manager });
    const plan = createPlan(request, intent, context);
    const execution = executePlan(request, plan);

    expect(execution.steps[0]?.status).toBe("blocked");
    expect(execution.steps.slice(1).every((s) => s.status === "skipped")).toBe(
      true,
    );
  });

  it("supports registering new plan templates later", () => {
    const registry = new PlanRegistry();
    registry.register({
      intentName: "demo.custom",
      priority: 50,
      build({ intent }) {
        return {
          goal: intent.goal,
          requiresApproval: false,
          steps: [
            draftStep("only", "Custom step", {
              tool: "echo",
              args: { text: "ok" },
            }),
          ],
        };
      },
    });

    // Also ensure default registry API exists for app wiring.
    registerPlanTemplate({
      intentName: "demo.global-plan",
      priority: 10,
      build() {
        return {
          goal: "global",
          requiresApproval: false,
          steps: [draftStep("g", "Global")],
        };
      },
    });

    const request = normalizeRequest({ source: "cli", rawInput: "x" });
    const intent = {
      name: "demo.custom",
      category: "workflow" as const,
      goal: "Custom",
      parameters: {},
      confidence: 1,
      capabilities: [],
      complexity: "low" as const,
      known: true,
    };
    const context = loadContext(request, intent, {
      manager: new ContextManager(),
    });
    const plan = createPlan(request, intent, context, { registry });
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]?.description).toBe("Custom step");
  });
});
