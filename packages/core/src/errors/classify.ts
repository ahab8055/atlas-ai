import { randomUUID } from "node:crypto";

import { suggestRecovery } from "./recovery.js";
import {
  ERROR_CATEGORY_LABELS,
  type AtlasErrorResponse,
  type ClassifyErrorInput,
  type ErrorCategory,
} from "./types.js";

const USER_CODES = new Set([
  "permission_blocked",
  "cancelled",
  "invalid_input",
  "unknown_intent",
  "user_rejected",
]);

const TOOL_CODES = new Set([
  "tool_failed",
  "not_found",
  "handler_error",
  "invalid_output",
  "async_unsupported",
  "permission_denied",
]);

const AI_CODES = new Set([
  "intent_failed",
  "plan_failed",
  "model_failed",
  "context_failed",
  "response_failed",
]);

/**
 * Infer category from error code / message when not provided.
 */
export function classifyCategory(
  code: string | undefined,
  message: string,
): ErrorCategory {
  const normalized = (code ?? "").toLowerCase();
  if (USER_CODES.has(normalized)) {
    return "user";
  }
  if (TOOL_CODES.has(normalized)) {
    return "tool";
  }
  if (AI_CODES.has(normalized)) {
    return "ai";
  }
  if (/permission|denied|approval|cancel/i.test(message)) {
    return "user";
  }
  if (/tool|handler|schema|not found/i.test(message)) {
    return "tool";
  }
  if (/model|intent|plan|llm|ai /i.test(message)) {
    return "ai";
  }
  return "system";
}

function causeText(cause: unknown): string | undefined {
  if (cause === undefined || cause === null) {
    return undefined;
  }
  if (cause instanceof Error) {
    return cause.message;
  }
  if (typeof cause === "string") {
    return cause;
  }
  try {
    return JSON.stringify(cause);
  } catch {
    return String(cause);
  }
}

function defaultUserMessage(
  category: ErrorCategory,
  message: string,
  code: string,
): string {
  switch (category) {
    case "user":
      if (code === "permission_blocked" || code === "permission_denied") {
        return "Atlas needs your approval before continuing. Review the permission request, then try again.";
      }
      if (code === "cancelled") {
        return "The task was cancelled before it finished.";
      }
      if (code === "unknown_intent") {
        return "I could not understand that request yet. Try help for supported commands.";
      }
      return `There’s a problem with the request: ${message}`;
    case "tool":
      return `A tool could not finish (${code.replace(/_/g, " ")}). ${message}`;
    case "ai":
      return `Atlas had trouble reasoning about that step. ${message}`;
    case "system":
    default:
      return `Something went wrong inside Atlas. ${message}`;
  }
}

/**
 * Build a consistent AtlasErrorResponse from a classified input.
 */
export function createAtlasError(
  input: ClassifyErrorInput,
): AtlasErrorResponse {
  const code = input.code ?? "unknown";
  const category = input.category ?? classifyCategory(code, input.message);
  const recovery = suggestRecovery(category, code);
  const recoverable =
    input.recoverable ?? recovery.some((action) => action.strategy !== "none");

  return {
    id: `err_${randomUUID()}`,
    category,
    code,
    message: input.message,
    userMessage: defaultUserMessage(category, input.message, code),
    recoverable,
    recovery,
    cause: causeText(input.cause),
    context: input.context,
    traceId: input.traceId,
    timestamp: new Date().toISOString(),
  };
}

/** Classify an unknown thrown value into an AtlasErrorResponse. */
export function fromUnknown(
  error: unknown,
  options: {
    code?: string;
    category?: ErrorCategory;
    context?: Record<string, unknown>;
    traceId?: string;
  } = {},
): AtlasErrorResponse {
  if (isAtlasErrorResponse(error)) {
    return error;
  }
  if (error instanceof AtlasError) {
    return error.toResponse();
  }
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unexpected error";
  return createAtlasError({
    code: options.code ?? "system_error",
    category: options.category ?? "system",
    message,
    cause: error instanceof Error ? error : undefined,
    context: options.context,
    traceId: options.traceId,
  });
}

export function isAtlasErrorResponse(
  value: unknown,
): value is AtlasErrorResponse {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as AtlasErrorResponse).id === "string" &&
    typeof (value as AtlasErrorResponse).category === "string" &&
    typeof (value as AtlasErrorResponse).code === "string" &&
    typeof (value as AtlasErrorResponse).userMessage === "string"
  );
}

/**
 * Throwable error that serializes to AtlasErrorResponse.
 */
export class AtlasError extends Error {
  readonly atlas: AtlasErrorResponse;

  constructor(input: ClassifyErrorInput | AtlasErrorResponse) {
    const response = isAtlasErrorResponse(input)
      ? input
      : createAtlasError(input);
    super(response.message);
    this.name = "AtlasError";
    this.atlas = response;
  }

  get category(): ErrorCategory {
    return this.atlas.category;
  }

  get code(): string {
    return this.atlas.code;
  }

  toResponse(): AtlasErrorResponse {
    return this.atlas;
  }

  static user(message: string, code = "user_error"): AtlasError {
    return new AtlasError({ category: "user", code, message });
  }

  static tool(message: string, code = "tool_failed"): AtlasError {
    return new AtlasError({ category: "tool", code, message });
  }

  static system(message: string, code = "system_error"): AtlasError {
    return new AtlasError({ category: "system", code, message });
  }

  static ai(message: string, code = "ai_error"): AtlasError {
    return new AtlasError({ category: "ai", code, message });
  }
}

export function formatErrorCategory(category: ErrorCategory): string {
  return ERROR_CATEGORY_LABELS[category];
}
