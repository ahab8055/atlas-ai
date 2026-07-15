import {
  executeTool,
  ToolExecutor,
  type ToolExecutionResult,
  type ToolRegistry,
} from "@atlas-ai/tools";

import type { PlanStep } from "../planning/types.js";
import type { NormalizedRequest } from "../types.js";
import type { StepResult } from "./types.js";

export interface ExecuteToolStepOptions {
  /** Optional dedicated executor (tests / DI). */
  executor?: ToolExecutor;
  /**
   * Bind a registry by constructing an executor when `executor` is omitted.
   * Prefer passing `executor` directly.
   */
  registry?: ToolRegistry;
  /** Forwarded to ToolExecutor (default false; plan controller already gates). */
  checkPermissions?: boolean;
}

function isToolRegistry(value: unknown): value is ToolRegistry {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ToolRegistry).get === "function" &&
    typeof (value as ToolRegistry).list === "function"
  );
}

/**
 * Execute a plan step via the tool execution framework.
 * Maps ToolExecutionResult → StepResult for the ExecutionController.
 */
export function executeToolStep(
  request: NormalizedRequest,
  step: PlanStep,
  options: ExecuteToolStepOptions | ToolRegistry = {},
): StepResult {
  // Back-compat: third arg used to be ToolRegistry alone.
  const opts: ExecuteToolStepOptions = isToolRegistry(options)
    ? { registry: options }
    : options;

  try {
    if (!step.tool) {
      return {
        stepId: step.id,
        status: "completed",
        output: step.description,
      };
    }

    const input: Record<string, unknown> = {
      ...(step.args ?? {}),
    };
    if (step.tool === "system.info" && input.source === undefined) {
      input.source = request.source;
    }

    const executor =
      opts.executor ??
      (opts.registry ? new ToolExecutor(opts.registry) : undefined);

    const execution: ToolExecutionResult = executor
      ? executor.execute({
          name: step.tool,
          input,
          context: {
            requestId: request.id,
            traceId: request.traceId,
            source: request.source,
            stepId: step.id,
          },
          checkPermissions: opts.checkPermissions ?? false,
        })
      : executeTool({
          name: step.tool,
          input,
          context: {
            requestId: request.id,
            traceId: request.traceId,
            source: request.source,
            stepId: step.id,
          },
          checkPermissions: opts.checkPermissions ?? false,
        });

    return mapExecutionToStep(step, execution);
  } catch (error) {
    return {
      stepId: step.id,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function mapExecutionToStep(
  step: PlanStep,
  execution: ToolExecutionResult,
): StepResult {
  if (!execution.ok) {
    return {
      stepId: step.id,
      status: "failed",
      error: execution.error ?? `Tool ${step.tool} failed`,
    };
  }

  return {
    stepId: step.id,
    status: "completed",
    output: execution.message ?? step.description,
  };
}
