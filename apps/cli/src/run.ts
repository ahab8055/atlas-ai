import {
  ContextManager,
  EventBus,
  bootstrapPlatformServices,
  createKnowledgeProvider,
  createMemoryProvider,
  createPlatformEventPublisher,
  createRequestHandler,
  toPlatformManagerOptions,
  type ContextBuilderOptions,
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
  createMemoryAnalyticsMonitor,
  createMemoryManager,
  createPersistentMemoryManager,
  createShortTermMemory,
  MemoryAccessLog,
  type LongTermMemory,
  type MemoryManager,
} from "@atlas-ai/memory";
import { createProfileManager, type ProfileManager } from "@atlas-ai/profile";
import { PermissionManager } from "@atlas-ai/security";
import {
  createWorkspaceManager,
  type WorkspaceManager,
} from "@atlas-ai/workspace";

import {
  createDebugEventPrinter,
  displayDebugMeta,
  displayResponse,
  shouldPrintDebugMeta,
} from "./display.js";
import { createCliMemoryDek } from "./memory-dek.js";
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
  profile?: ProfileManager;
  workspace?: WorkspaceManager;
  permissions: PermissionManager;
  memoryAccessLog: MemoryAccessLog;
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

  const permissions = new PermissionManager({
    grantedCapabilities: ["memory.read", "memory.write"],
  });

  bootstrapPlatformServices({
    ...toPlatformManagerOptions(config.platform, {
      permissionManager: permissions,
      logger: logger.child("platform"),
      onPlatformEvent: config.platform.features.platformEvents
        ? createPlatformEventPublisher(eventBus)
        : undefined,
    }),
  });

  const memoryAccessLog = new MemoryAccessLog();
  const memoryAnalytics = createMemoryAnalyticsMonitor();
  const longTermMemory = database
    ? createLongTermMemory(database.memories, {
        permissions,
        dek: createCliMemoryDek(database.path),
        accessLog: memoryAccessLog,
        analytics: memoryAnalytics,
        logger: logger.child("memory"),
      })
    : undefined;
  const knowledgeGraph = database
    ? createKnowledgeGraph(createSqliteGraphStore(database))
    : undefined;
  const profile = database
    ? createProfileManager(database.userPreferences, {
        observations: database.preferenceObservations,
        suggestions: database.preferenceSuggestions,
      })
    : undefined;
  const workspace = database
    ? createWorkspaceManager(database.projects, database.userPreferences)
    : undefined;

  if (workspace && config.workspace?.autoDetect) {
    workspace.detectAndRegister({
      cwd: process.cwd(),
      remember: config.workspace.rememberOnDetect !== false,
    });
  }

  const shortTerm = createShortTermMemory({
    maxEntries: config.memory.shortTerm.maxEntries,
    ttlMs: config.memory.shortTerm.ttlMs,
    memoryManager,
  });

  const activeProjectId = workspace?.getActive()?.id;

  const providers: import("@atlas-ai/core").ContextProvider[] = [];
  if (longTermMemory) {
    providers.push(
      createMemoryProvider(
        longTermMemory.createRetriever({
          limit: config.memory.retrieval.limit,
          minScore: config.memory.retrieval.minScore,
          recencyHalfLifeMs: config.memory.retrieval.recencyHalfLifeMs,
          projectId: activeProjectId,
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
    preferenceStore: profile?.asPreferenceStore(),
    projectLoader: () => workspace?.getActiveContext(),
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
    contextBuilder: resolveContextBuilderOptions(config),
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
    profile,
    workspace,
    permissions,
    memoryAccessLog,
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
  maybeLearnProfile(runtime, rawInput, result);

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

function maybeLearnProfile(
  runtime: CliRuntime,
  rawInput: string,
  result: PipelineResult,
): void {
  const learning = runtime.config.profile?.learning;
  if (!runtime.profile || !learning?.enabled || !learning.learnOnRequest) {
    return;
  }
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
    const autoApply =
      learning.autoApply === true || learning.requireApproval === false;
    if (autoApply) {
      runtime.profile.learnFromText(text, {
        minConfidence: learning.minConfidence,
        autoApply: true,
      });
      return;
    }
    const observed = runtime.profile.observeFromText(text, {
      minConfidence: learning.minConfidence,
      minOccurrences: learning.minOccurrences ?? 2,
    });
    if (observed.suggestionsCreated.length > 0) {
      const n = observed.suggestionsCreated.length;
      process.stdout.write(
        `${n} preference suggestion(s) — atlas profile suggestions\n`,
      );
    }
  } catch {
    // Learning must not break the user-facing response path
  }
}

export function closeCliRuntime(runtime: CliRuntime): void {
  runtime.database?.close();
}

/** Merge context builder + compression config; optionally scale maxChars to model window. */
export function resolveContextBuilderOptions(
  config: AtlasConfig,
): ContextBuilderOptions {
  const builder = config.context?.builder;
  const compression = config.context?.compression;
  let maxChars = builder?.maxChars ?? 4000;
  if (builder?.scaleToModelContext !== false) {
    const contextSize = config.ai?.hardware?.contextSize ?? 4096;
    const scaled = Math.floor(contextSize * 4 * 0.35);
    maxChars = Math.min(maxChars, Math.max(1024, scaled));
  }
  return {
    maxChars,
    maxMemorySnippets: builder?.maxMemorySnippets,
    maxKnowledgeSnippets: builder?.maxKnowledgeSnippets,
    maxConversationTurns: builder?.maxConversationTurns,
    compression: compression
      ? {
          enabled: compression.enabled,
          keepRecentTurns: compression.keepRecentTurns,
          maxSummaryLines: compression.maxSummaryLines,
          nearDuplicateThreshold: compression.nearDuplicateThreshold,
        }
      : undefined,
  };
}
