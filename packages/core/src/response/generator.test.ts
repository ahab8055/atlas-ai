import { describe, expect, it } from "vitest";

import { normalizeRequest } from "../normalize.js";
import { unknownIntent } from "../intent/index.js";
import type { DetectedIntent } from "../intent/types.js";
import type { ExecutionResult } from "../execution/types.js";
import {
  explainFailures,
  generateResponse,
  ResponseGenerator,
} from "./index.js";

function baseExecution(
  overrides: Partial<ExecutionResult> = {},
): ExecutionResult {
  return {
    taskId: "task-1",
    status: "completed",
    lifecycle: "completed",
    progress: {
      totalSteps: 1,
      completedSteps: 1,
      failedSteps: 0,
      blockedSteps: 0,
      skippedSteps: 0,
      cancelledSteps: 0,
      percent: 100,
    },
    steps: [
      {
        stepId: "echo",
        status: "completed",
        output: "hello atlas",
      },
    ],
    failures: [],
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    ...overrides,
  };
}

function echoIntent(): DetectedIntent {
  return {
    name: "echo",
    category: "system",
    goal: "Echo text",
    confidence: 1,
    complexity: "low",
    known: true,
    parameters: { text: "hello atlas" },
    capabilities: ["system.info"],
  };
}

describe("response generation", () => {
  it("produces meaningful completed responses with task status", () => {
    const request = normalizeRequest({
      source: "cli",
      rawInput: "echo hello atlas",
    });
    const response = generateResponse(request, echoIntent(), baseExecution());

    expect(response.text).toContain("hello atlas");
    expect(response.text).toContain("Task status: Completed");
    expect(response.summary).toContain("Echo");
    expect(response.status).toBe("completed");
    expect(response.errors).toEqual([]);
    expect(response.spokenText.length).toBeGreaterThan(0);
    expect(response.modality).toBe("text");
  });

  it("explains errors clearly on failed tasks", () => {
    const request = normalizeRequest({ source: "cli", rawInput: "boom" });
    const intent = echoIntent();
    const execution = baseExecution({
      status: "failed",
      lifecycle: "failed",
      progress: {
        totalSteps: 1,
        completedSteps: 0,
        failedSteps: 1,
        blockedSteps: 0,
        skippedSteps: 0,
        cancelledSteps: 0,
        percent: 100,
      },
      steps: [{ stepId: "s1", status: "failed", error: "disk full" }],
      failures: [
        {
          stepId: "s1",
          message: "disk full",
          code: "tool_failed",
          at: new Date().toISOString(),
        },
      ],
    });

    const response = generateResponse(request, intent, execution);

    expect(response.status).toBe("failed");
    expect(response.text).toContain("Task status: Failed");
    expect(response.text).toContain("Errors:");
    expect(response.errors[0]).toContain("disk full");
    expect(response.errors[0]).toMatch(/Tool Error|tool/i);
    expect(response.structuredErrors).toHaveLength(1);
    expect(response.structuredErrors[0]?.category).toBe("tool");
    expect(response.structuredErrors[0]?.recovery.length).toBeGreaterThan(0);
    expect(response.nextSteps.length).toBeGreaterThan(0);
    expect(response.spokenText).toContain("failed");
  });

  it("includes warnings and next steps when blocked by permissions", () => {
    const request = normalizeRequest({
      source: "cli",
      rawInput: "Open VS Code",
    });
    const intent: DetectedIntent = {
      name: "application.open",
      category: "application_control",
      goal: "Open VS Code",
      confidence: 1,
      complexity: "low",
      known: true,
      parameters: { application: "VS Code" },
      capabilities: ["application.control"],
    };
    const execution = baseExecution({
      status: "blocked",
      lifecycle: "failed",
      progress: {
        totalSteps: 1,
        completedSteps: 0,
        failedSteps: 0,
        blockedSteps: 1,
        skippedSteps: 0,
        cancelledSteps: 0,
        percent: 100,
      },
      steps: [
        {
          stepId: "open",
          status: "blocked",
          error: "Permission require_confirmation for application.control",
        },
      ],
      failures: [
        {
          stepId: "open",
          message: "Permission require_confirmation for application.control",
          code: "permission_blocked",
          at: new Date().toISOString(),
        },
      ],
    });

    const response = generateResponse(request, intent, execution);

    expect(response.status).toBe("blocked");
    expect(response.text).toContain("Task status: Blocked");
    expect(response.errors[0]).toMatch(/approval/i);
    expect(response.structuredErrors[0]?.category).toBe("user");
    expect(response.structuredErrors[0]?.code).toBe("permission_blocked");
    expect(response.nextSteps.some((s) => /Approve|permission/i.test(s))).toBe(
      true,
    );
  });

  it("supports future voice responses via spokenText and modality", () => {
    const generator = new ResponseGenerator();
    const request = normalizeRequest({
      source: "voice",
      rawInput: "status",
    });
    const response = generator.generate({
      request,
      intent: {
        name: "system.status",
        category: "system",
        goal: "Show runtime status",
        confidence: 1,
        complexity: "low",
        known: true,
        parameters: {},
        capabilities: ["system.info"],
      },
      execution: baseExecution({
        steps: [
          {
            stepId: "status",
            status: "completed",
            output: "Atlas core OK",
          },
        ],
      }),
    });

    expect(response.modality).toBe("voice");
    expect(response.spokenText).toContain("Atlas core OK");
    expect(response.spokenText).toContain("Status:");
  });

  it("handles unknown intents with clear guidance", () => {
    const request = normalizeRequest({
      source: "cli",
      rawInput: "do something weird",
    });
    const response = generateResponse(
      request,
      unknownIntent(request.text),
      baseExecution({
        status: "completed",
        steps: [{ stepId: "noop", status: "completed" }],
      }),
    );

    expect(response.text).toContain("could not classify");
    expect(response.text).toContain("Task status: Completed");
    expect(response.spokenText).toMatch(/classify|help/i);
    expect(response.nextSteps.length).toBeGreaterThan(0);
    expect(response.structuredErrors).toHaveLength(1);
    expect(response.structuredErrors[0]?.category).toBe("user");
    expect(response.structuredErrors[0]?.code).toBe("unknown_intent");
    expect(response.errors[0]).toMatch(/understand|help/i);
  });

  it("surfaces recalled memories in completed responses", () => {
    const request = normalizeRequest({
      source: "cli",
      rawInput: "echo hello",
    });
    const response = generateResponse(
      request,
      echoIntent(),
      baseExecution(),
      undefined,
      undefined,
      {
        memories: [
          {
            id: "m1",
            content: "User prefers dark mode interfaces",
            kind: "semantic",
            score: 0.9,
          },
        ],
      } as never,
    );

    expect(response.text).toContain("Recalled memories");
    expect(response.text).toContain("dark mode");
  });

  it("appends related knowledge when context has knowledge snippets", () => {
    const request = normalizeRequest({
      source: "cli",
      rawInput: "echo hello",
    });
    const response = generateResponse(
      request,
      echoIntent(),
      baseExecution(),
      undefined,
      undefined,
      {
        knowledge: [
          {
            id: "e1",
            label: "Atlas",
            content: "project: Atlas",
            score: 0.8,
          },
        ],
      } as never,
    );

    expect(response.text).toContain("Related knowledge");
    expect(response.text).toContain("Atlas");
  });
});

describe("explainFailures", () => {
  it("maps failure codes to actionable explanations", () => {
    const lines = explainFailures([
      {
        code: "permission_blocked",
        message: "Permission denied",
        stepId: "open",
        at: new Date().toISOString(),
      },
    ]);
    expect(lines[0]).toContain("Permission denied");
    expect(lines[0]).toContain("open");
    expect(lines[0]).toMatch(/User Error|approval/i);
  });
});
