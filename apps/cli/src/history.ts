import type { AtlasDatabase, TaskHistoryQuery } from "@atlas-ai/database";

export interface ParsedHistoryCommand {
  query: TaskHistoryQuery;
}

/**
 * Parse `history` CLI / REPL commands.
 * Examples: history | history --limit 5 | history --status failed
 */
export function parseHistoryCommand(
  rawInput: string,
): ParsedHistoryCommand | null {
  const tokens = rawInput.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens[0]!.toLowerCase() !== "history") {
    return null;
  }

  const query: TaskHistoryQuery = { limit: 20, includeSteps: true };
  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (token === "--limit" || token === "-n") {
      const next = tokens[i + 1];
      if (!next) {
        throw new Error("Missing value for --limit");
      }
      query.limit = Number.parseInt(next, 10);
      if (!Number.isFinite(query.limit) || query.limit < 1) {
        throw new Error("--limit must be a positive integer");
      }
      i += 1;
      continue;
    }
    if (token === "--status") {
      const next = tokens[i + 1];
      if (!next) {
        throw new Error("Missing value for --status");
      }
      query.status = next;
      i += 1;
      continue;
    }
    if (token === "--intent") {
      const next = tokens[i + 1];
      if (!next) {
        throw new Error("Missing value for --intent");
      }
      query.intent = next;
      i += 1;
      continue;
    }
    if (token === "--no-steps") {
      query.includeSteps = false;
      continue;
    }
    throw new Error(`Unknown history option: ${token}`);
  }

  return { query };
}

/** Format task history for terminal review (UI-shaped fields). */
export function formatTaskHistory(
  database: AtlasDatabase,
  query: TaskHistoryQuery,
): string {
  const result = database.taskHistory.query(query);
  if (result.items.length === 0) {
    return "No task history yet.";
  }

  const lines: string[] = [
    `Task history (${result.items.length} of ${result.total}):`,
    "",
  ];

  for (const [index, item] of result.items.entries()) {
    lines.push(
      `${index + 1}. [${item.display.statusLabel}] ${item.display.headline}`,
    );
    if (item.display.subtitle) {
      lines.push(`   ${item.display.subtitle}`);
    }
    lines.push(
      `   steps ${item.display.completedStepCount}/${item.display.stepCount} · id=${item.id}`,
    );
    if (item.display.hasFailures) {
      for (const failure of item.failures.slice(0, 3)) {
        const where = failure.stepId ? ` (${failure.stepId})` : "";
        lines.push(`   ! ${failure.message}${where}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
