import type { PermissionCapability, RiskLevel } from "@atlas-ai/security";

/**
 * Lightweight JSON Schema subset for tool I/O (Architecture/05 Tool Schema).
 * Full JSON Schema validation can layer on later.
 */
export interface ToolJsonSchema {
  type?: "object" | "string" | "number" | "boolean" | "array" | "null";
  description?: string;
  properties?: Record<string, ToolJsonSchema>;
  required?: string[];
  items?: ToolJsonSchema;
  additionalProperties?: boolean;
}

/**
 * Tool metadata — Name, Description, Permissions, Input/Output Schema (+ version).
 */
export interface ToolMetadata {
  /** Stable tool id, e.g. `filesystem.search`. */
  name: string;
  description: string;
  /** Semver string, e.g. `1.0.0`. */
  version: string;
  permissions: PermissionCapability[];
  risk: RiskLevel;
  inputSchema: ToolJsonSchema;
  outputSchema: ToolJsonSchema;
  /** Optional discovery tags. */
  tags?: string[];
}

export interface ToolContext {
  requestId?: string;
  traceId?: string;
  source?: string;
  stepId?: string;
}

export interface ToolResult {
  ok: boolean;
  /** Machine-readable payload matching outputSchema intent. */
  data?: Record<string, unknown>;
  /** Human-readable summary for pipeline/response. */
  message?: string;
  error?: string;
}

/** Consistent tool handler interface. */
export type ToolHandler = (
  input: Record<string, unknown>,
  context: ToolContext,
) => ToolResult | Promise<ToolResult>;

export interface RegisteredTool {
  metadata: ToolMetadata;
  handler: ToolHandler;
}

export interface ToolDiscoveryQuery {
  /** Substring match on name or description (case-insensitive). */
  q?: string;
  /** Require all listed tags. */
  tags?: string[];
  /** Require all listed permissions. */
  permissions?: PermissionCapability[];
  /** Name prefix, e.g. `filesystem.`. */
  namePrefix?: string;
}
