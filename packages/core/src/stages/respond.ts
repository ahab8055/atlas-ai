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
    return {
      intent: intent.name,
      status: execution.status,
      text: [
        "Atlas AI — available commands & intents:",
        "  help                                  Show this message",
        "  status | ping                         Runtime status",
        "  echo <text>                           Echo text through the pipeline",
        "  Open VS Code                          Application Control (simple plan)",
        "  Find my project files                 File Search (simple plan)",
        "  Explain this code                     Code Analysis (simple plan)",
        "  Prepare my development environment    Multi-step setup plan",
        "  <unrecognized>                        Handled as unknown intent",
      ].join("\n"),
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

  if (execution.status === "blocked" || execution.status === "partial") {
    const reason =
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
    lines.push(`Status: ${execution.status}`, `Detail: ${reason}`);
    return {
      intent: intent.name,
      status: execution.status,
      text: lines.join("\n"),
    };
  }

  if (execution.status === "failed") {
    const error =
      execution.steps.find((s) => s.error)?.error ?? "Unknown failure";
    return {
      intent: intent.name,
      status: execution.status,
      text: `Request failed: ${error}`,
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
