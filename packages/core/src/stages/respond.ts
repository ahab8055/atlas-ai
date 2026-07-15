import { listToolMetadata } from "@atlas-ai/tools";

import { formatPlanSteps } from "../planning/builders.js";
import type {
  DetectedIntent,
  ExecutionPlan,
  ExecutionResult,
  NormalizedRequest,
  PipelineResponse,
} from "../types.js";

/**
 * Turn execution results into a user-facing response.
 */
export function generateResponse(
  request: NormalizedRequest,
  intent: DetectedIntent,
  execution: ExecutionResult,
  plan?: ExecutionPlan,
): PipelineResponse {
  if (intent.name === "help") {
    const toolNames = listToolMetadata()
      .map((t) => t.name)
      .sort()
      .join(", ");
    return {
      intent: intent.name,
      status: execution.status,
      text: [
        "Atlas AI — available commands & intents:",
        "  help                                  Show this message",
        "  status | ping                         Runtime status",
        "  echo <text>                           Echo text through the pipeline",
        "  tools | list tools                    List registered tools",
        "  Open VS Code                          Application Control (simple plan)",
        "  Find my project files                 File Search (simple plan)",
        "  Explain this code                     Code Analysis (simple plan)",
        "  Prepare my development environment    Multi-step setup plan",
        "  <unrecognized>                        Handled as unknown intent",
        "",
        `Registered tools: ${toolNames || "(none)"}`,
      ].join("\n"),
    };
  }

  if (intent.name === "tools.list") {
    const lines = listToolMetadata().map(
      (t) => `- ${t.name}@${t.version} [${t.risk}] — ${t.description}`,
    );
    return {
      intent: intent.name,
      status: execution.status,
      text: [`Atlas tool registry (${lines.length}):`, ...lines].join("\n"),
    };
  }

  if (!intent.known || intent.name === "unknown") {
    return {
      intent: intent.name,
      status: execution.status,
      text: [
        "I could not classify that request yet.",
        `Received: "${request.text}"`,
        "Try: help · Open VS Code · Prepare my development environment",
      ].join("\n"),
    };
  }

  if (execution.status === "failed") {
    const error =
      execution.failures[0]?.message ??
      execution.steps.find((s) => s.error)?.error ??
      "Unknown failure";
    const lines = [`Request failed: ${error}`];
    if (execution.lifecycle) {
      lines.push(`Lifecycle: ${execution.lifecycle}`);
    }
    if (execution.failures.length > 1) {
      lines.push(
        ...execution.failures
          .slice(1)
          .map((f) => `- ${f.message}${f.stepId ? ` (${f.stepId})` : ""}`),
      );
    }
    return {
      intent: intent.name,
      status: execution.status,
      text: lines.join("\n"),
    };
  }

  if (execution.status === "cancelled") {
    return {
      intent: intent.name,
      status: execution.status,
      text: [
        "Execution cancelled.",
        execution.failures[0]?.message ?? "Cancelled by request",
        `Progress: ${execution.progress.percent}%`,
      ].join("\n"),
    };
  }

  if (execution.status === "blocked" || execution.status === "partial") {
    const reason =
      execution.failures[0]?.message ??
      execution.steps.find((s) => s.error)?.error ??
      "permission approval required";
    const lines = [
      `Understood: ${intent.goal}`,
      `Category: ${intent.category}`,
      `Parameters: ${formatParams(intent)}`,
    ];
    if (plan) {
      lines.push(`Plan (${plan.kind}): ${plan.goal}`, formatPlanSteps(plan));
    }
    lines.push(
      `Lifecycle: ${execution.lifecycle}`,
      `Status: ${execution.status}`,
      `Progress: ${execution.progress.completedSteps}/${execution.progress.totalSteps} steps`,
      `Detail: ${reason}`,
    );
    return {
      intent: intent.name,
      status: execution.status,
      text: lines.join("\n"),
    };
  }

  const outputs = execution.steps
    .filter((s) => s.output)
    .map((s) => s.output)
    .join("\n");

  if (plan?.kind === "multi" && outputs) {
    return {
      intent: intent.name,
      status: execution.status,
      text: [`Plan complete: ${plan.goal}`, outputs].join("\n"),
    };
  }

  return {
    intent: intent.name,
    status: execution.status,
    text: outputs || `${intent.goal} (${intent.category})`,
  };
}

function formatParams(intent: DetectedIntent): string {
  const entries = Object.entries(intent.parameters).filter(
    ([, value]) => value !== undefined && value !== "",
  );
  if (entries.length === 0) {
    return "(none)";
  }
  return entries.map(([key, value]) => `${key}=${String(value)}`).join(", ");
}
