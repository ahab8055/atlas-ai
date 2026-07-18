import {
  createLogger,
  type Logger,
  type LoggerOptions,
} from "@atlas-ai/logging";

import type { ContextManager } from "./context/manager.js";
import type { ContextBuilderOptions } from "./context/builder.js";
import type { EventBus } from "./events/index.js";
import type { ExecutionController } from "./execution/controller.js";
import { runPipeline, type PipelineOptions } from "./pipeline.js";
import type { IncomingRequest, PipelineResult } from "./types.js";

export interface RequestHandlerOptions {
  logger?: Logger;
  loggerOptions?: Omit<LoggerOptions, "service"> & { service?: string };
  contextManager?: ContextManager;
  executionController?: ExecutionController;
  eventBus?: EventBus;
  /** Context Builder options (ADR-0053). */
  contextBuilder?: ContextBuilderOptions;
}

/**
 * Request handler entrypoint used by CLI / desktop / voice adapters.
 */
export function createRequestHandler(options: RequestHandlerOptions = {}) {
  const logger =
    options.logger ??
    createLogger({
      service: options.loggerOptions?.service ?? "atlas-core",
      level: options.loggerOptions?.level ?? "info",
      category: options.loggerOptions?.category ?? "application",
      sink: options.loggerOptions?.sink,
    });

  return {
    logger,
    contextManager: options.contextManager,
    executionController: options.executionController,
    eventBus: options.eventBus,
    handle(incoming: IncomingRequest): PipelineResult {
      return runPipeline(incoming, {
        logger,
        contextManager: options.contextManager,
        executionController: options.executionController,
        eventBus: options.eventBus,
        contextBuilder: options.contextBuilder,
      } satisfies PipelineOptions);
    },
  };
}

/** One-shot convenience wrapper around `createRequestHandler`. */
export function handleRequest(
  incoming: IncomingRequest,
  options: RequestHandlerOptions = {},
): PipelineResult {
  return createRequestHandler(options).handle(incoming);
}
