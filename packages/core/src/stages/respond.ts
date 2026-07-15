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
        "Atlas AI — available commands:",
        "  help              Show this message",
        "  status | ping     Runtime status",
        "  echo <text>       Echo text through the pipeline",
        "  <anything else>   Conversational stub reply",
      ].join("\n"),
    };
  }

  if (execution.status === "blocked") {
    return {
      intent: intent.name,
      status: execution.status,
      text: "Action blocked pending permission approval.",
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

  if (intent.name === "conversational.reply") {
    return {
      intent: intent.name,
      status: execution.status,
      text: `Received (${request.source}): "${request.text}". Full LLM/agent reply is not wired yet.`,
    };
  }

  return {
    intent: intent.name,
    status: execution.status,
    text: outputs || "Done.",
  };
}
