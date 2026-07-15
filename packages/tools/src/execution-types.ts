import type { PermissionEvaluation } from "@atlas-ai/security";

import type { ToolContext, ToolResult } from "./types.js";

export type ToolExecutionStatus =
  "completed" | "failed" | "invalid_input" | "not_found" | "permission_denied";

export type ToolExecutionErrorCode =
  | "not_found"
  | "invalid_input"
  | "permission_denied"
  | "handler_error"
  | "invalid_output"
  | "async_unsupported";

export interface ToolExecutionRequest {
  name: string;
  input?: Record<string, unknown>;
  version?: string;
  context?: ToolContext;
  /**
   * When true, evaluate metadata permissions via `@atlas-ai/security`.
   * Core plan runs usually leave this false (ExecutionController already gates).
   */
  checkPermissions?: boolean;
  /** Previously granted capabilities for Level-1 tools. */
  grantedCapabilities?: ReadonlySet<string>;
}

/**
 * Captured tool run returned to Atlas core (Architecture/05 observable execution).
 */
export interface ToolExecutionResult {
  id: string;
  toolName: string;
  toolVersion?: string;
  status: ToolExecutionStatus;
  ok: boolean;
  input: Record<string, unknown>;
  /** Raw handler result when available. */
  output?: ToolResult;
  data?: Record<string, unknown>;
  message?: string;
  error?: string;
  errorCode?: ToolExecutionErrorCode;
  validationErrors?: string[];
  permission?: PermissionEvaluation;
  durationMs: number;
  startedAt: string;
  finishedAt: string;
}
