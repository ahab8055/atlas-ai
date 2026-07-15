import { describe, expect, it } from "vitest";

import { normalizeRequest } from "../normalize.js";
import {
  detectIntent,
  IntentRegistry,
  type IntentDefinition,
} from "./index.js";

function detect(text: string) {
  return detectIntent(normalizeRequest({ source: "cli", rawInput: text }));
}

describe("intent detection", () => {
  it("classifies Open VS Code as Application Control", () => {
    const intent = detect("Open VS Code");
    expect(intent.known).toBe(true);
    expect(intent.name).toBe("application.open");
    expect(intent.category).toBe("application_control");
    expect(intent.parameters.application).toBe("VS Code");
    expect(intent.goal).toContain("VS Code");
    expect(intent.capabilities).toContain("application.control");
  });

  it("classifies Find my project files as File Search", () => {
    const intent = detect("Find my project files");
    expect(intent.name).toBe("file.search");
    expect(intent.category).toBe("file_search");
    expect(intent.parameters.keyword).toBe("project files");
    expect(intent.parameters.query).toBe("project files");
  });

  it("classifies Explain this code as Code Analysis", () => {
    const intent = detect("Explain this code");
    expect(intent.name).toBe("code.analyze");
    expect(intent.category).toBe("code_analysis");
    expect(intent.parameters.target).toBe("code");
    expect(intent.parameters.focus).toBe("explain");
  });

  it("keeps a consistent DetectedIntent shape", () => {
    const intent = detect("Search documents");
    expect(intent).toMatchObject({
      name: expect.any(String),
      category: expect.any(String),
      goal: expect.any(String),
      parameters: expect.any(Object),
      confidence: expect.any(Number),
      capabilities: expect.any(Array),
      complexity: expect.any(String),
      known: expect.any(Boolean),
    });
  });

  it("handles unknown intents gracefully", () => {
    const intent = detect("teleport my coffee mug to mars");
    expect(intent.known).toBe(false);
    expect(intent.name).toBe("unknown");
    expect(intent.category).toBe("unknown");
    expect(intent.parameters.text).toBe("teleport my coffee mug to mars");
    expect(intent.confidence).toBeLessThan(0.5);
  });

  it("supports registering new intents later", () => {
    const custom: IntentDefinition = {
      name: "workflow.demo",
      category: "conversation",
      goal: "Run demo workflow",
      capabilities: [],
      complexity: "low",
      priority: 95,
      match(normalizedText) {
        if (normalizedText === "run demo workflow") {
          return { confidence: 0.99, parameters: { workflow: "demo" } };
        }
        return null;
      },
    };

    const registry = new IntentRegistry();
    registry.register(custom);

    const local = detectIntent(
      normalizeRequest({ source: "cli", rawInput: "run demo workflow" }),
      { registry },
    );
    expect(local.name).toBe("workflow.demo");
    expect(local.parameters.workflow).toBe("demo");
    expect(local.known).toBe(true);
  });
});
