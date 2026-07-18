import {
  ContextManager,
  EventBus,
  createKnowledgeProvider,
  createMemoryProvider,
  createRequestHandler,
  type PipelineResult,
} from "@atlas-ai/core";
import { loadConfig } from "@atlas-ai/config";
import type { AtlasConfig } from "@atlas-ai/config";
import { openAtlasDatabase, type AtlasDatabase } from "@atlas-ai/database";
import {
  createKnowledgeGraph,
  createSqliteGraphStore,
  type KnowledgeGraphManager,
} from "@atlas-ai/knowledge";
import {
  createLogger,
  formatLogRecord,
  parseLogLevel,
  type LogSink,
  type Logger,
} from "@atlas-ai/logging";
import {
  createLongTermMemory,
  createMemoryManager,
  createPersistentMemoryManager,
  createShortTermMemory,
  type LongTermMemory,
  type MemoryManager,
} from "@atlas-ai/memory";

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
  config: AtlasConfig;
  database?: AtlasDatabase;
  memoryManager: MemoryManager;
  longTermMemory?: LongTermMemory;
  knowledgeGraph?: KnowledgeGraphManager;
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
  const config = loadConfig();

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

  const memoryManager = database
    ? createPersistentMemoryManager(database.memories)
    : createMemoryManager();
  const longTermMemory = database
    ? createLongTermMemory(database.memories)
    : undefined;
  const knowledgeGraph = database
    ? createKnowledgeGraph(createSqliteGraphStore(database))
    : undefined;

  const shortTerm = createShortTermMemory({
    maxEntries: config.memory.shortTerm.maxEntries,
    ttlMs: config.memory.shortTerm.ttlMs,
    memoryManager,
  });

  const providers: import("@atlas-ai/core").ContextProvider[] = [];
  if (longTermMemory) {
    providers.push(
      createMemoryProvider(
        longTermMemory.createRetriever({
          limit: config.memory.retrieval.limit,
          minScore: config.memory.retrieval.minScore,
          recencyHalfLifeMs: config.memory.retrieval.recencyHalfLifeMs,
        }),
      ),
    );
  }
  if (knowledgeGraph) {
    providers.push(
      createKnowledgeProvider(
        knowledgeGraph.createRetriever({
          limit: config.knowledge.retrieval.limit,
          minScore: config.knowledge.retrieval.minScore,
          maxDepth: config.knowledge.retrieval.maxDepth,
          recencyHalfLifeMs: config.knowledge.retrieval.recencyHalfLifeMs,
        }),
      ),
    );
  }

  const contextManager = new ContextManager({
    conversationStore: shortTerm.toConversationStore(),
    providers: providers.length > 0 ? providers : undefined,
  });

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

  return {
    handler,
    eventBus,
    contextManager,
    logger,
    config,
    database,
    memoryManager,
    longTermMemory,
    knowledgeGraph,
  };
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

  maybeExtractKnowledge(runtime, rawInput, result);

  displayResponse(result);
  if (shouldPrintDebugMeta(options)) {
    displayDebugMeta(result);
  }
  return result;
}

function maybeExtractKnowledge(
  runtime: CliRuntime,
  rawInput: string,
  result: PipelineResult,
): void {
  const extraction = runtime.config.knowledge?.extraction;
  if (
    !runtime.knowledgeGraph ||
    !extraction?.enabled ||
    !extraction.extractOnRequest
  ) {
    return;
  }
  // Only ingest after successful pipeline turns
  if (
    result.execution.status === "failed" ||
    result.execution.status === "blocked" ||
    result.response.status === "failed"
  ) {
    return;
  }
  const text = rawInput.trim();
  if (!text || text.length < 8) {
    return;
  }
  try {
    const relationships = runtime.config.knowledge?.relationships;
    runtime.knowledgeGraph.extractAndStore(text, {
      thresholds: { minConfidence: extraction.minConfidence },
      autoLinkOnExtract: relationships?.autoLinkOnExtract,
      reinforceOnLink: relationships?.reinforceOnLink,
      reinforceStep: relationships?.reinforceStep,
    });
  } catch {
    // Extraction must not break the user-facing response path
  }
}

export function closeCliRuntime(runtime: CliRuntime): void {
  runtime.database?.close();
}
