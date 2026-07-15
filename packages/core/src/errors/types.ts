/**
 * Central error categories (user story).
 * Aligns with Architecture/22 failure types (permission → user, tool, model → ai, infra → system).
 */
export type ErrorCategory = "user" | "tool" | "system" | "ai";

export const ERROR_CATEGORY_LABELS: Record<ErrorCategory, string> = {
  user: "User Error",
  tool: "Tool Error",
  system: "System Error",
  ai: "AI Error",
};

/** Recovery strategies from Architecture/22 Failure Handling. */
export type RecoveryStrategy =
  "retry" | "ask_user" | "use_alternative" | "notify" | "skip" | "none";

export interface RecoveryAction {
  strategy: RecoveryStrategy;
  /** Human-readable next step. */
  description: string;
  attempted?: boolean;
  succeeded?: boolean;
}

/**
 * Consistent error response format for logs, pipeline, and UI.
 */
export interface AtlasErrorResponse {
  id: string;
  category: ErrorCategory;
  /** Machine code, e.g. `permission_blocked`, `tool_failed`. */
  code: string;
  /** Technical message for developers / logs. */
  message: string;
  /** Understandable message for the user. */
  userMessage: string;
  recoverable: boolean;
  recovery: RecoveryAction[];
  cause?: string;
  context?: Record<string, unknown>;
  traceId?: string;
  timestamp: string;
}

export interface ClassifyErrorInput {
  code?: string;
  message: string;
  category?: ErrorCategory;
  cause?: unknown;
  context?: Record<string, unknown>;
  traceId?: string;
  recoverable?: boolean;
}
