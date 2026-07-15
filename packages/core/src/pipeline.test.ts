import { createLogger, type LogRecord } from "@atlas-ai/logging";
import { describe, expect, it } from "vitest";

import {
  ContextManager,
  CORE_EVENTS,
  createRequestHandler,
  EventBus,
  handleRequest,
  ORCHESTRATION_EVENTS,
} from "./index.js";
import type { AtlasEvent } from "./events/index.js";

function createCapturingLogger() {
  const records: LogRecord[] = [];
  const logger = createLogger({
    service: "test-core",
    level: "info",
    sink: {
      write(record) {
        records.push(record);
      },
    },
  });
  return { logger, records };
}

describe("request processing pipeline", () => {
  it("publishes core events on the event bus for subscribers", () => {
    const bus = new EventBus({ historyLimit: 50 });
    const seen: string[] = [];
    bus.subscribe("*", (event: AtlasEvent) => {
      seen.push(event.type);
    });

    handleRequest(
      { source: "cli", rawInput: "status" },
      {
        logger: createCapturingLogger().logger,
        contextManager: new ContextManager(),
        eventBus: bus,
      },
    );

    for (const type of CORE_EVENTS) {
      expect(seen).toContain(type);
    }
    expect(bus.getHistory().every((e) => e.traceId)).toBe(true);
    expect(bus.getHistory()[0]?.source).toBe("atlas.pipeline");
  });

  it("normalizes CLI input and runs all orchestration stages", () => {
    const { logger, records } = createCapturingLogger();
    const result = handleRequest(
      { source: "cli", rawInput: "  status  " },
      { logger, contextManager: new ContextManager() },
    );

    expect(result.request.source).toBe("cli");
    expect(result.request.text).toBe("status");
    expect(result.intent.name).toBe("system.status");
    expect(result.context.sources).toContain("conversation");
    expect(result.context.preferences.preferredEditor).toBe("VS Code");
    expect(result.execution.status).toBe("completed");
    expect(result.response.text).toContain("Atlas core OK");

    const events = records.map((r) => r.message);
    for (const event of ORCHESTRATION_EVENTS) {
      expect(events).toContain(event);
    }

    expect(records.every((r) => r.traceId === result.request.traceId)).toBe(
      true,
    );
  });

  it("handles help and echo intents", () => {
    const help = handleRequest(
      { source: "cli", rawInput: "help" },
      {
        logger: createCapturingLogger().logger,
        contextManager: new ContextManager(),
      },
    );
    expect(help.intent.name).toBe("help");
    expect(help.response.text).toContain("available commands");

    const echo = handleRequest(
      { source: "cli", rawInput: "echo hello atlas" },
      {
        logger: createCapturingLogger().logger,
        contextManager: new ContextManager(),
      },
    );
    expect(echo.intent.name).toBe("echo");
    expect(echo.response.text).toContain("hello atlas");
    expect(echo.response.status).toBe("completed");
    expect(echo.response.spokenText).toContain("hello atlas");
    expect(echo.response.errors).toEqual([]);
  });

  it("accepts future input sources without changing the pipeline", () => {
    const handler = createRequestHandler({
      logger: createCapturingLogger().logger,
      contextManager: new ContextManager(),
    });

    for (const source of ["desktop", "voice", "api"] as const) {
      const result = handler.handle({
        source,
        rawInput: "ping",
      });
      expect(result.request.source).toBe(source);
      expect(result.intent.name).toBe("system.status");
      expect(result.response.status).toBe("completed");
    }
  });

  it("returns a conversational stub for unknown commands", () => {
    const result = handleRequest(
      { source: "cli", rawInput: "teleport my coffee mug to mars" },
      {
        logger: createCapturingLogger().logger,
        contextManager: new ContextManager(),
      },
    );

    expect(result.intent.name).toBe("unknown");
    expect(result.intent.known).toBe(false);
    expect(result.response.text).toContain("could not classify");
    expect(result.response.structuredErrors[0]?.code).toBe("unknown_intent");
  });

  it("logs structured errors and recovers from unexpected pipeline throws", () => {
    const { logger, records } = createCapturingLogger();
    const bus = new EventBus();
    const blocked = handleRequest(
      { source: "cli", rawInput: "Open VS Code" },
      { logger, contextManager: new ContextManager(), eventBus: bus },
    );

    expect(blocked.execution.failures.length).toBeGreaterThan(0);
    expect(
      records.some(
        (r) =>
          r.context?.errorCode === "permission_blocked" ||
          r.context?.errorCategory === "user",
      ),
    ).toBe(true);
    expect(blocked.response.structuredErrors[0]?.category).toBe("user");

    const throwingController = {
      execute() {
        throw new Error("controller exploded");
      },
    };

    const degraded = handleRequest(
      { source: "cli", rawInput: "status" },
      {
        logger,
        contextManager: new ContextManager(),
        executionController: throwingController as never,
      },
    );

    expect(degraded.execution.status).toBe("failed");
    expect(degraded.response.structuredErrors[0]?.category).toBe("system");
    expect(degraded.response.errors[0]).toMatch(/Something went wrong|system/i);
    expect(degraded.response.nextSteps.length).toBeGreaterThan(0);
  });

  it("classifies story example commands through the pipeline", () => {
    const logger = createCapturingLogger().logger;
    const contextManager = new ContextManager();

    const open = handleRequest(
      { source: "cli", rawInput: "Open VS Code" },
      { logger, contextManager },
    );
    expect(open.intent.category).toBe("application_control");
    expect(open.intent.parameters.application).toBe("VS Code");
    expect(open.response.text).toMatch(
      /Application Control|Blocked|Understood/,
    );

    const search = handleRequest(
      { source: "cli", rawInput: "Find my project files" },
      { logger, contextManager },
    );
    expect(search.intent.category).toBe("file_search");
    expect(search.intent.parameters.query).toBe("project files");

    const code = handleRequest(
      { source: "cli", rawInput: "Explain this code" },
      { logger, contextManager },
    );
    expect(code.intent.category).toBe("code_analysis");
    expect(code.intent.parameters.target).toBe("code");
  });

  it("builds a multi-step plan for preparing the development environment", () => {
    const result = handleRequest(
      {
        source: "cli",
        rawInput: "Prepare my development environment",
      },
      {
        logger: createCapturingLogger().logger,
        contextManager: new ContextManager(),
      },
    );

    expect(result.intent.name).toBe("environment.setup");
    expect(result.plan.kind).toBe("multi");
    expect(result.plan.steps).toHaveLength(4);
    expect(result.plan.steps.map((s) => s.order)).toEqual([1, 2, 3, 4]);
    expect(result.execution.lifecycle).toBe("failed");
    expect(result.execution.failures.length).toBeGreaterThan(0);
    expect(result.response.text).toContain("Open VS Code");
    expect(result.response.text).toContain("Start backend");
  });

  it("loads context before execution and records conversation", () => {
    const contextManager = new ContextManager();
    const logger = createCapturingLogger().logger;

    const first = handleRequest(
      { source: "cli", rawInput: "status", sessionId: "s-ctx" },
      { logger, contextManager },
    );
    expect(first.context.conversation.turns.length).toBeGreaterThanOrEqual(1);

    const second = handleRequest(
      { source: "cli", rawInput: "help", sessionId: "s-ctx" },
      { logger, contextManager },
    );
    expect(second.context.conversation.turns.length).toBeGreaterThan(
      first.context.conversation.turns.length,
    );
  });

  it("lists registered tools through the pipeline", () => {
    const result = handleRequest(
      { source: "cli", rawInput: "list tools" },
      {
        logger: createCapturingLogger().logger,
        contextManager: new ContextManager(),
      },
    );

    expect(result.intent.name).toBe("tools.list");
    expect(result.response.text).toContain("system.info");
    expect(result.response.text).toContain("file.search");
    expect(result.response.text).toContain("@1.0.0");
  });
});
