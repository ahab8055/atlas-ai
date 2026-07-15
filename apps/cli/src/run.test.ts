import { describe, expect, it } from "vitest";

import { exitCodeForResult } from "./display.js";
import type { CliOptions } from "./options.js";
import { recordPipelineResult } from "./persist.js";
import { closeCliRuntime, createCliRuntime, executeCommand } from "./run.js";

function baseOptions(overrides: Partial<CliOptions> = {}): CliOptions {
  return {
    commandArgs: [],
    interactive: false,
    quiet: true,
    debug: false,
    sessionId: "test-session",
    showCliHelp: false,
    enableDatabase: false,
    ...overrides,
  };
}

describe("CLI → core runtime", () => {
  it("processes commands through the core pipeline and returns a response", () => {
    const options = baseOptions();
    const runtime = createCliRuntime(options);
    const result = executeCommand(runtime, options, "status");

    expect(result.request.source).toBe("cli");
    expect(result.intent.name).toBe("system.status");
    expect(result.response.text).toContain("Atlas core OK");
    expect(result.response.status).toBe("completed");
    expect(exitCodeForResult(result)).toBe(0);
  });

  it("keeps session continuity across turns (REPL adapter path)", () => {
    const options = baseOptions({ sessionId: "cli-repl" });
    const runtime = createCliRuntime(options);

    executeCommand(runtime, options, "status");
    const second = executeCommand(runtime, options, "help");

    expect(second.context.conversation.sessionId).toBe("cli-repl");
    expect(second.context.conversation.turns.length).toBeGreaterThan(1);
  });

  it("uses source cli so desktop/voice can replace the adapter later", () => {
    const options = baseOptions();
    const runtime = createCliRuntime(options);
    const result = executeCommand(runtime, options, "echo adapter-ok");

    expect(result.request.source).toBe("cli");
    expect(result.request.metadata.adapter).toBe("cli");
    expect(result.response.text).toContain("adapter-ok");
  });

  it("persists execution history when database is enabled", () => {
    const options = baseOptions({
      enableDatabase: true,
      databasePath: ":memory:",
    });
    const runtime = createCliRuntime(options);
    expect(runtime.database).toBeDefined();

    const result = executeCommand(runtime, options, "status");
    recordPipelineResult(runtime.database!, result);

    const history = runtime.database!.taskHistory.listRecent(5);
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0]?.intent).toBe("system.status");
    expect(history[0]?.timestamps.createdAt).toBeTruthy();
    expect(runtime.database!.tools.list().length).toBeGreaterThan(0);

    closeCliRuntime(runtime);
  });
});
