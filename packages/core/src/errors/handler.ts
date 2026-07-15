import type { Logger } from "@atlas-ai/logging";

import type { ExecutionFailure } from "../execution/types.js";
import {
  AtlasError,
  createAtlasError,
  fromUnknown,
  isAtlasErrorResponse,
} from "./classify.js";
import type { AtlasErrorResponse, ErrorCategory } from "./types.js";

export interface HandleErrorOptions {
  logger?: Logger;
  traceId?: string;
  context?: Record<string, unknown>;
  /** Override inferred category. */
  category?: ErrorCategory;
  code?: string;
  /** When false, skip logging (already logged). Default true. */
  log?: boolean;
}

/**
 * Central error handler — classify, log, return consistent response.
 */
export class ErrorHandler {
  constructor(private readonly defaultLogger?: Logger) {}

  handle(error: unknown, options: HandleErrorOptions = {}): AtlasErrorResponse {
    const response = this.toResponse(error, options);
    if (options.log !== false) {
      this.log(response, options.logger ?? this.defaultLogger);
    }
    return response;
  }

  toResponse(
    error: unknown,
    options: HandleErrorOptions = {},
  ): AtlasErrorResponse {
    if (isAtlasErrorResponse(error)) {
      return {
        ...error,
        traceId: error.traceId ?? options.traceId,
        context: { ...options.context, ...error.context },
      };
    }
    if (error instanceof AtlasError) {
      const response = error.toResponse();
      return {
        ...response,
        traceId: response.traceId ?? options.traceId,
        context: { ...options.context, ...response.context },
      };
    }
    return fromUnknown(error, {
      code: options.code,
      category: options.category,
      context: options.context,
      traceId: options.traceId,
    });
  }

  /** Map execution-controller failures into AtlasErrorResponse. */
  fromExecutionFailure(
    failure: ExecutionFailure,
    options: HandleErrorOptions = {},
  ): AtlasErrorResponse {
    return this.handle(
      createAtlasError({
        code: failure.code,
        message: failure.message,
        context: {
          stepId: failure.stepId,
          at: failure.at,
          ...options.context,
        },
        traceId: options.traceId,
      }),
      { ...options, log: options.log ?? false },
    );
  }

  log(error: AtlasErrorResponse, logger?: Logger): void {
    const log = logger ?? this.defaultLogger;
    if (!log) {
      return;
    }
    const level =
      error.category === "system" || error.category === "ai" ? "error" : "warn";
    const logCategory =
      error.category === "tool"
        ? ("tool" as const)
        : error.category === "user"
          ? ("security" as const)
          : error.category === "ai"
            ? ("ai" as const)
            : ("application" as const);
    const payload = {
      category: logCategory,
      traceId: error.traceId,
      error: {
        name: `AtlasError:${error.category}`,
        message: error.message,
      },
      context: {
        errorId: error.id,
        errorCategory: error.category,
        errorCode: error.code,
        userMessage: error.userMessage,
        recoverable: error.recoverable,
        recovery: error.recovery.map((action) => action.strategy),
        ...error.context,
      },
    };
    if (level === "error") {
      log.error(error.message, payload);
    } else {
      log.warn(error.message, payload);
    }
  }
}

let defaultHandler: ErrorHandler | undefined;

export function getDefaultErrorHandler(): ErrorHandler {
  defaultHandler ??= new ErrorHandler();
  return defaultHandler;
}

export function setDefaultErrorHandler(handler: ErrorHandler): void {
  defaultHandler = handler;
}

/** Convenience: classify + log. */
export function handleError(
  error: unknown,
  options: HandleErrorOptions = {},
): AtlasErrorResponse {
  return getDefaultErrorHandler().handle(error, options);
}
