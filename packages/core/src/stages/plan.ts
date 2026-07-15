import type {
  DetectedIntent,
  ExecutionPlan,
  LoadedContext,
  NormalizedRequest,
} from "../types.js";

/**
 * Basic planner — maps intent + parameters to executable steps.
 */
export function createPlan(
  request: NormalizedRequest,
  intent: DetectedIntent,
  _context: LoadedContext,
): ExecutionPlan {
  switch (intent.name) {
    case "help":
      return {
        requiresApproval: false,
        steps: [
          {
            id: "help",
            description: "Show available commands",
          },
        ],
      };

    case "system.status":
      return {
        requiresApproval: false,
        steps: [
          {
            id: "status",
            description: "Read runtime status",
            tool: "system.info",
            capability: "system.info",
          },
        ],
      };

    case "echo":
      return {
        requiresApproval: false,
        steps: [
          {
            id: "echo",
            description: "Echo user text",
            tool: "echo",
            args: {
              text: String(intent.parameters.text ?? "(empty)"),
            },
          },
        ],
      };

    case "application.open":
      return {
        requiresApproval: true,
        steps: [
          {
            id: "open-app",
            description: intent.goal,
            tool: "application.open",
            capability: "application.control",
            args: {
              application: String(intent.parameters.application ?? ""),
            },
          },
        ],
      };

    case "file.search":
      return {
        requiresApproval: true,
        steps: [
          {
            id: "search-files",
            description: intent.goal,
            tool: "file.search",
            capability: "filesystem.read",
            args: {
              query: String(
                intent.parameters.query ?? intent.parameters.keyword ?? "",
              ),
            },
          },
        ],
      };

    case "code.analyze":
      return {
        requiresApproval: true,
        steps: [
          {
            id: "analyze-code",
            description: intent.goal,
            tool: "code.analyze",
            capability: "filesystem.read",
            args: {
              target: String(intent.parameters.target ?? ""),
              focus: String(intent.parameters.focus ?? "explain"),
            },
          },
        ],
      };

    case "unknown":
      return {
        requiresApproval: false,
        steps: [
          {
            id: "unknown",
            description: "Acknowledge unrecognized intent",
            args: { text: request.text },
          },
        ],
      };

    default:
      return {
        requiresApproval: false,
        steps: [
          {
            id: "reply",
            description: `Handle intent ${intent.name}`,
            args: { text: request.text, ...intent.parameters },
          },
        ],
      };
  }
}
