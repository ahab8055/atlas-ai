import {
  ContextManager,
  EventBus,
  createRequestHandler,
  type PipelineResult,
} from "@atlas-ai/core";
import {
  createLogger,
  formatLogRecord,
  parseLogLevel,
  type LogSink,
  type Logger,
} from "@atlas-ai/logging";

import {
  createDebugEventPrinter,
  displayDebugMeta,
  displayResponse,
  shouldPrintDebugMeta,
} from "./display.js";
import type { CliOptions } from "./options.js";

/** Keep stage logs off stdout so responses stay scriptable. */
export function createStderrSink(): LogSink {
  return {
    write(record) {
      process.stderr.write(`${formatLogRecord(record)}\n`);
    },
  };
}

export interface CliRuntime {
  handler: ReturnType<typeof createRequestHandler>;
  eventBus: EventBus;
  contextManager: ContextManager;
  logger: Logger;
}

/**
 * Build a CLI runtime wired to the core request pipeline.
 * Desktop/voice adapters use the same `createRequestHandler` with a different source.
 */
export function createCliRuntime(options: CliOptions): CliRuntime {
  const level = options.debug
    ? "debug"
    : options.quiet
      ? "error"
      : parseLogLevel(process.env.ATLAS_LOG_LEVEL);

  const logger = createLogger({
    service: "atlas-cli",
    level,
    category: "application",
    sink: createStderrSink(),
  });

  const eventBus = new EventBus({ historyLimit: options.debug ? 200 : 0 });
  const contextManager = new ContextManager();

  if (options.debug) {
    const print = createDebugEventPrinter();
    eventBus.subscribe("*", (event) => {
      const summary = event.traceId ? `trace=${event.traceId}` : "";
      print(event.type, summary);
    });
  }

  const handler = createRequestHandler({
    logger,
    eventBus,
    contextManager,
  });

  return { handler, eventBus, contextManager, logger };
}

/** Execute one command through core without I/O (testable). */
export function executeCommand(
  runtime: CliRuntime,
  options: CliOptions,
  rawInput: string,
): PipelineResult {
  return runtime.handler.handle({
    source: "cli",
    rawInput,
    sessionId: options.sessionId,
    metadata: {
      adapter: "cli",
      debug: options.debug,
      interactive: options.interactive,
    },
  });
}

/** Run one user command through the core runtime and display the response. */
export function runCommand(
  runtime: CliRuntime,
  options: CliOptions,
  rawInput: string,
): PipelineResult {
  const result = executeCommand(runtime, options, rawInput);
  displayResponse(result);
  if (shouldPrintDebugMeta(options)) {
    displayDebugMeta(result);
  }
  return result;
}
