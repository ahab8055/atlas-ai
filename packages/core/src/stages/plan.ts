import type {
  DetectedIntent,
  ExecutionPlan,
  LoadedContext,
  NormalizedRequest,
} from "../types.js";

/**
 * Basic planner — maps intent to executable steps.
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

    case "echo": {
      const payload = request.text.replace(/^echo\s*/i, "").trim();
      return {
        requiresApproval: false,
        steps: [
          {
            id: "echo",
            description: "Echo user text",
            tool: "echo",
            args: { text: payload || "(empty)" },
          },
        ],
      };
    }

    default:
      return {
        requiresApproval: false,
        steps: [
          {
            id: "reply",
            description: "Acknowledge conversational input",
            args: { text: request.text },
          },
        ],
      };
  }
}
