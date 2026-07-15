import type { PlanStep } from "../planning/types.js";
import type { NormalizedRequest } from "../types.js";
import type { StepResult } from "./types.js";

/**
 * Built-in tool stubs — replaced by `@atlas-ai/tools` later.
 */
export function executeToolStep(
  request: NormalizedRequest,
  step: PlanStep,
): StepResult {
  try {
    if (step.tool === "system.info") {
      return {
        stepId: step.id,
        status: "completed",
        output: `Atlas core OK (source=${request.source})`,
      };
    }

    if (step.tool === "echo") {
      return {
        stepId: step.id,
        status: "completed",
        output: String(step.args?.text ?? ""),
      };
    }

    if (step.tool === "application.open") {
      const application = String(step.args?.application ?? "unknown");
      return {
        stepId: step.id,
        status: "completed",
        output: `Application Control: would open "${application}" (launcher not wired yet).`,
      };
    }

    if (step.tool === "file.search") {
      const query = String(step.args?.query ?? "");
      return {
        stepId: step.id,
        status: "completed",
        output: `File Search: would search for "${query}" (search tool not wired yet).`,
      };
    }

    if (step.tool === "code.analyze") {
      const target = String(step.args?.target ?? "");
      return {
        stepId: step.id,
        status: "completed",
        output: `Code Analysis: would explain "${target}" (analyzer not wired yet).`,
      };
    }

    if (step.tool === "project.open") {
      const project = String(step.args?.project ?? "project");
      const path = step.args?.path ? ` at ${String(step.args.path)}` : "";
      return {
        stepId: step.id,
        status: "completed",
        output: `Project: would open "${project}"${path} (project tool not wired yet).`,
      };
    }

    if (step.tool === "process.start") {
      const name = String(step.args?.name ?? "process");
      const command = String(step.args?.command ?? "");
      return {
        stepId: step.id,
        status: "completed",
        output: `Process: would start ${name}${command ? ` (${command})` : ""} (process tool not wired yet).`,
      };
    }

    return {
      stepId: step.id,
      status: "completed",
      output: step.description,
    };
  } catch (error) {
    return {
      stepId: step.id,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
