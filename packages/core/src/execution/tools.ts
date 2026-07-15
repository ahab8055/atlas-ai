import { getDefaultToolRegistry, type ToolRegistry } from "@atlas-ai/tools";

import type { PlanStep } from "../planning/types.js";
import type { NormalizedRequest } from "../types.js";
import type { StepResult } from "./types.js";

/**
 * Execute a plan step via the centralized tool registry.
 */
export function executeToolStep(
  request: NormalizedRequest,
  step: PlanStep,
  registry: ToolRegistry = getDefaultToolRegistry(),
): StepResult {
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

    const result = registry.invoke(step.tool, input, {
      requestId: request.id,
      traceId: request.traceId,
      source: request.source,
      stepId: step.id,
    });

    // MVP handlers are sync; keep sync StepResult for the controller.
    if (result instanceof Promise) {
      return {
        stepId: step.id,
        status: "failed",
        error: `Tool ${step.tool} returned async result; async tools not wired yet`,
      };
    }

    if (!result.ok) {
      return {
        stepId: step.id,
        status: "failed",
        error: result.error ?? `Tool ${step.tool} failed`,
      };
    }

    return {
      stepId: step.id,
      status: "completed",
      output: result.message ?? step.description,
    };
  } catch (error) {
    return {
      stepId: step.id,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
