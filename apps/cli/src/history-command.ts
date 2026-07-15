import type { CliRuntime } from "./run.js";
import { formatTaskHistory, parseHistoryCommand } from "./history.js";

/**
 * Handle `history` without going through the request pipeline.
 * Returns true when the input was a history command.
 */
export function tryHandleHistoryCommand(
  runtime: CliRuntime,
  rawInput: string,
): boolean {
  let parsed;
  try {
    parsed = parseHistoryCommand(rawInput);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 2;
    return true;
  }

  if (!parsed) {
    return false;
  }

  if (!runtime.database) {
    process.stderr.write(
      "Task history requires the database. Remove --no-db / ATLAS_DB_DISABLED.\n",
    );
    process.exitCode = 1;
    return true;
  }

  process.stdout.write(
    `${formatTaskHistory(runtime.database, parsed.query)}\n`,
  );
  process.exitCode = 0;
  return true;
}
