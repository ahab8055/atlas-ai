import {
  createLogger,
  type Logger,
  type LoggerOptions,
} from "@atlas-ai/logging";

import { runPipeline, type PipelineOptions } from "./pipeline.js";
import type { IncomingRequest, PipelineResult } from "./types.js";

export interface RequestHandlerOptions {
  logger?: Logger;
  loggerOptions?: Omit<LoggerOptions, "service"> & { service?: string };
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
    handle(incoming: IncomingRequest): PipelineResult {
      return runPipeline(incoming, { logger } satisfies PipelineOptions);
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
