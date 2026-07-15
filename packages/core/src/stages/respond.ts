import type {
  DetectedIntent,
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
): PipelineResponse {
  if (intent.name === "help") {
    return {
      intent: intent.name,
      status: execution.status,
      text: [
        "Atlas AI — available commands & intents:",
        "  help                         Show this message",
        "  status | ping                Runtime status",
        "  echo <text>                  Echo text through the pipeline",
        "  Open VS Code                 Application Control intent",
        "  Find my project files        File Search intent",
        "  Explain this code            Code Analysis intent",
        "  <unrecognized>               Handled as unknown intent",
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
        "Try: help · Open VS Code · Find my project files · Explain this code",
      ].join("\n"),
    };
  }

  if (execution.status === "blocked") {
    const reason =
      execution.steps.find((s) => s.error)?.error ??
      "permission approval required";
    return {
      intent: intent.name,
      status: execution.status,
      text: [
        `Understood: ${intent.goal}`,
        `Category: ${intent.category}`,
        `Parameters: ${formatParams(intent)}`,
        `Blocked: ${reason}`,
      ].join("\n"),
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
