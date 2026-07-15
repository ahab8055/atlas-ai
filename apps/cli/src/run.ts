import {
  ContextManager,
  EventBus,
  createRequestHandler,
  type PipelineResult,
} from "@atlas-ai/core";
import { openAtlasDatabase, type AtlasDatabase } from "@atlas-ai/database";
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
import {
  recordPipelineResult,
  syncModelsToDatabase,
  syncToolsToDatabase,
} from "./persist.js";

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
  database?: AtlasDatabase;
}

/**
 * Build a CLI runtime wired to the core request pipeline.
 * Opens SQLite automatically unless `--no-db` / `ATLAS_DB_DISABLED=1`.
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

  let database: AtlasDatabase | undefined;
  if (options.enableDatabase) {
    database = openAtlasDatabase({ path: options.databasePath });
    const toolCount = syncToolsToDatabase(database);
    const modelCount = syncModelsToDatabase(database);
    if (options.debug) {
      process.stderr.write(
        `[debug] database=${database.path} schema=${database.schemaVersion} tools=${toolCount} models=${modelCount}\n`,
      );
    }
  }

  const handler = createRequestHandler({
    logger,
    eventBus,
    contextManager,
  });

  return { handler, eventBus, contextManager, logger, database };
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
      database: Boolean(runtime.database),
    },
  });
}

/** Run one user command through the core runtime, persist, and display. */
export function runCommand(
  runtime: CliRuntime,
  options: CliOptions,
  rawInput: string,
): PipelineResult {
  const result = executeCommand(runtime, options, rawInput);
  if (runtime.database) {
    recordPipelineResult(runtime.database, result);
  }
  displayResponse(result);
  if (shouldPrintDebugMeta(options)) {
    displayDebugMeta(result);
  }
  return result;
}

export function closeCliRuntime(runtime: CliRuntime): void {
  runtime.database?.close();
}
