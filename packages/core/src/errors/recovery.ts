import type { ErrorCategory, RecoveryAction } from "./types.js";

/**
 * Suggest recovery actions (Architecture/22 Failure Handling).
 * Does not execute them — callers / UI decide.
 */
export function suggestRecovery(
  category: ErrorCategory,
  code: string,
): RecoveryAction[] {
  switch (category) {
    case "user":
      if (code === "permission_blocked" || code === "permission_denied") {
        return [
          {
            strategy: "ask_user",
            description:
              "Approve or deny the pending permission, then retry the command.",
          },
        ];
      }
      if (code === "unknown_intent") {
        return [
          {
            strategy: "ask_user",
            description: "Rephrase the request, or run help for examples.",
          },
        ];
      }
      if (code === "cancelled") {
        return [
          {
            strategy: "retry",
            description: "Run the command again when you are ready.",
          },
        ];
      }
      return [
        {
          strategy: "ask_user",
          description: "Adjust the request and try again.",
        },
      ];

    case "tool":
      return [
        {
          strategy: "retry",
          description: "Retry the same tool step.",
        },
        {
          strategy: "use_alternative",
          description: "Try an alternative tool if one is available.",
        },
        {
          strategy: "notify",
          description: "Report the tool failure if it keeps happening.",
        },
      ];

    case "ai":
      return [
        {
          strategy: "retry",
          description: "Retry the request; a later attempt may succeed.",
        },
        {
          strategy: "notify",
          description: "If this continues, check model / intent configuration.",
        },
      ];

    case "system":
    default:
      return [
        {
          strategy: "notify",
          description: "Check logs for a system error, then retry.",
        },
        {
          strategy: "retry",
          description:
            "Retry after confirming the runtime is healthy (status).",
        },
      ];
  }
}

/**
 * Mark the first recovery action as attempted (foundation for future auto-retry).
 */
export function markRecoveryAttempted(
  actions: RecoveryAction[],
  strategy: RecoveryAction["strategy"],
  succeeded: boolean,
): RecoveryAction[] {
  return actions.map((action) =>
    action.strategy === strategy
      ? { ...action, attempted: true, succeeded }
      : action,
  );
}
