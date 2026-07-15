import {
  getDefaultPermissionManager,
  type PermissionCapability,
  type PermissionManager,
} from "@atlas-ai/security";
import { randomUUID } from "node:crypto";

import type {
  ToolExecutionRequest,
  ToolExecutionResult,
} from "./execution-types.js";
import type { ToolRegistry } from "./registry.js";
import { getDefaultToolRegistry } from "./registry.js";
import { validateAgainstSchema } from "./schema.js";
import type { ToolContext, ToolResult } from "./types.js";

const KNOWN_CAPABILITIES = new Set<PermissionCapability>([
  "system.info",
  "filesystem.read",
  "filesystem.write",
  "filesystem.delete",
  "terminal.execute",
  "browser.access",
  "application.control",
  "network.access",
  "settings.change",
  "software.install",
]);

function asCapability(value: string): PermissionCapability | null {
  return KNOWN_CAPABILITIES.has(value as PermissionCapability)
    ? (value as PermissionCapability)
    : null;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Tool execution engine — validate → optional permission → execute → capture.
 */
export class ToolExecutor {
  private readonly history: ToolExecutionResult[] = [];
  private readonly maxHistory: number;
  private readonly permissions: PermissionManager;

  constructor(
    private readonly registry: ToolRegistry = getDefaultToolRegistry(),
    options: {
      maxHistory?: number;
      permissions?: PermissionManager;
    } = {},
  ) {
    this.maxHistory = options.maxHistory ?? 100;
    this.permissions = options.permissions ?? getDefaultPermissionManager();
  }

  /** Recent executions for monitoring (newest last). */
  getHistory(): readonly ToolExecutionResult[] {
    return this.history;
  }

  clearHistory(): void {
    this.history.length = 0;
  }

  /**
   * Execute a registered tool safely.
   * Always returns a structured result — never throws for tool/handler failures.
   */
  execute(request: ToolExecutionRequest): ToolExecutionResult {
    const startedAt = nowIso();
    const startedMs = Date.now();
    const input = { ...(request.input ?? {}) };
    const context: ToolContext = { ...(request.context ?? {}) };
    const id = randomUUID();

    const finish = (
      partial: Omit<
        ToolExecutionResult,
        "id" | "input" | "durationMs" | "startedAt" | "finishedAt"
      >,
    ): ToolExecutionResult => {
      const finishedAt = nowIso();
      const result: ToolExecutionResult = {
        id,
        input,
        startedAt,
        finishedAt,
        durationMs: Date.now() - startedMs,
        ...partial,
      };
      this.pushHistory(result);
      return result;
    };

    const tool = this.registry.get(request.name, request.version);
    if (!tool) {
      return finish({
        toolName: request.name,
        toolVersion: request.version,
        status: "not_found",
        ok: false,
        error: request.version
          ? `Unknown tool: ${request.name}@${request.version}`
          : `Unknown tool: ${request.name}`,
        errorCode: "not_found",
      });
    }

    const validation = validateAgainstSchema(input, tool.metadata.inputSchema);
    if (!validation.valid) {
      return finish({
        toolName: tool.metadata.name,
        toolVersion: tool.metadata.version,
        status: "invalid_input",
        ok: false,
        error: `Invalid input for ${tool.metadata.name}: ${validation.errors.join("; ")}`,
        errorCode: "invalid_input",
        validationErrors: validation.errors,
      });
    }

    if (request.checkPermissions) {
      const additionalGrants = [...(request.grantedCapabilities ?? [])].filter(
        (c): c is PermissionCapability => asCapability(c) !== null,
      );

      for (const permission of tool.metadata.permissions) {
        const check = this.permissions.requestPermission(
          {
            capability: permission,
            reason: `Execute tool ${tool.metadata.name}`,
            resource: context.stepId ?? context.requestId,
          },
          { additionalGrants },
        );
        if (check.blocked) {
          return finish({
            toolName: tool.metadata.name,
            toolVersion: tool.metadata.version,
            status: "permission_denied",
            ok: false,
            error: check.evaluation.message,
            errorCode: "permission_denied",
            permission: check.evaluation,
          });
        }
      }
    }

    let handlerResult: ToolResult;
    try {
      const raw = tool.handler(input, context);
      if (raw instanceof Promise) {
        return finish({
          toolName: tool.metadata.name,
          toolVersion: tool.metadata.version,
          status: "failed",
          ok: false,
          error: `Tool ${tool.metadata.name} returned async result; use async execution later`,
          errorCode: "async_unsupported",
        });
      }
      handlerResult = raw;
    } catch (error) {
      return finish({
        toolName: tool.metadata.name,
        toolVersion: tool.metadata.version,
        status: "failed",
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        errorCode: "handler_error",
      });
    }

    if (!handlerResult.ok) {
      return finish({
        toolName: tool.metadata.name,
        toolVersion: tool.metadata.version,
        status: "failed",
        ok: false,
        output: handlerResult,
        data: handlerResult.data,
        message: handlerResult.message,
        error: handlerResult.error ?? `Tool ${tool.metadata.name} failed`,
        errorCode: "handler_error",
      });
    }

    if (handlerResult.data !== undefined) {
      const outputValidation = validateAgainstSchema(
        handlerResult.data,
        tool.metadata.outputSchema,
      );
      if (!outputValidation.valid) {
        return finish({
          toolName: tool.metadata.name,
          toolVersion: tool.metadata.version,
          status: "failed",
          ok: false,
          output: handlerResult,
          data: handlerResult.data,
          message: handlerResult.message,
          error: `Invalid output for ${tool.metadata.name}: ${outputValidation.errors.join("; ")}`,
          errorCode: "invalid_output",
          validationErrors: outputValidation.errors,
        });
      }
    }

    return finish({
      toolName: tool.metadata.name,
      toolVersion: tool.metadata.version,
      status: "completed",
      ok: true,
      output: handlerResult,
      data: handlerResult.data,
      message: handlerResult.message,
    });
  }

  private pushHistory(result: ToolExecutionResult): void {
    this.history.push(result);
    while (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }
}

let defaultExecutor: ToolExecutor | undefined;

export function getDefaultToolExecutor(): ToolExecutor {
  defaultExecutor ??= new ToolExecutor();
  return defaultExecutor;
}

export function setDefaultToolExecutor(executor: ToolExecutor): void {
  defaultExecutor = executor;
}

/** Convenience entry for Atlas core and adapters. */
export function executeTool(
  request: ToolExecutionRequest,
): ToolExecutionResult {
  return getDefaultToolExecutor().execute(request);
}
