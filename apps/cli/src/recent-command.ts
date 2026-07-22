import type { CliRuntime } from "./run.js";
import { formatRecentFiles, parseRecentCommand } from "./recent.js";

/**
 * Handle `recent` without going through the request pipeline.
 * Returns true when the input was a recent-files command.
 */
export function tryHandleRecentCommand(
  runtime: CliRuntime,
  rawInput: string,
): boolean {
  let parsed;
  try {
    parsed = parseRecentCommand(rawInput);
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
      "Recent files requires the database. Remove --no-db / ATLAS_DB_DISABLED.\n",
    );
    process.exitCode = 1;
    return true;
  }

  process.stdout.write(
    `${formatRecentFiles(runtime.database, parsed.query)}\n`,
  );
  process.exitCode = 0;
  return true;
}
