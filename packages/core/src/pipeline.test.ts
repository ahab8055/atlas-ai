import { createLogger, type LogRecord } from "@atlas-ai/logging";
import { describe, expect, it } from "vitest";

import {
  createRequestHandler,
  handleRequest,
  ORCHESTRATION_EVENTS,
} from "./index.js";

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
  it("normalizes CLI input and runs all orchestration stages", () => {
    const { logger, records } = createCapturingLogger();
    const result = handleRequest(
      { source: "cli", rawInput: "  status  " },
      { logger },
    );

    expect(result.request.source).toBe("cli");
    expect(result.request.text).toBe("status");
    expect(result.intent.name).toBe("system.status");
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
      { logger: createCapturingLogger().logger },
    );
    expect(help.intent.name).toBe("help");
    expect(help.response.text).toContain("available commands");

    const echo = handleRequest(
      { source: "cli", rawInput: "echo hello atlas" },
      { logger: createCapturingLogger().logger },
    );
    expect(echo.intent.name).toBe("echo");
    expect(echo.response.text).toBe("hello atlas");
  });

  it("accepts future input sources without changing the pipeline", () => {
    const handler = createRequestHandler({
      logger: createCapturingLogger().logger,
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
      { source: "cli", rawInput: "prepare my development environment" },
      { logger: createCapturingLogger().logger },
    );

    expect(result.intent.name).toBe("unknown");
    expect(result.intent.known).toBe(false);
    expect(result.response.text).toContain("could not classify");
  });

  it("classifies story example commands through the pipeline", () => {
    const logger = createCapturingLogger().logger;

    const open = handleRequest(
      { source: "cli", rawInput: "Open VS Code" },
      { logger },
    );
    expect(open.intent.category).toBe("application_control");
    expect(open.intent.parameters.application).toBe("VS Code");
    expect(open.response.text).toMatch(
      /Application Control|Blocked|Understood/,
    );

    const search = handleRequest(
      { source: "cli", rawInput: "Find my project files" },
      { logger },
    );
    expect(search.intent.category).toBe("file_search");
    expect(search.intent.parameters.query).toBe("project files");

    const code = handleRequest(
      { source: "cli", rawInput: "Explain this code" },
      { logger },
    );
    expect(code.intent.category).toBe("code_analysis");
    expect(code.intent.parameters.target).toBe("code");
  });
});
