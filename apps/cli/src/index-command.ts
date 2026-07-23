import type { CliRuntime } from "./run.js";
import {
  formatIndexBuild,
  formatIndexSearch,
  formatIndexStatus,
  parseIndexCommand,
} from "./index-cmd.js";

/**
 * Handle `index` without going through the request pipeline.
 * Returns true when the input was an index command.
 */
export function tryHandleIndexCommand(
  runtime: CliRuntime,
  rawInput: string,
): boolean {
  let parsed;
  try {
    parsed = parseIndexCommand(rawInput);
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

  if (!runtime.fileIndexer || !runtime.database) {
    process.stderr.write(
      "File index requires the database. Remove --no-db / ATLAS_DB_DISABLED.\n",
    );
    process.exitCode = 1;
    return true;
  }

  if (parsed.kind === "build") {
    const result = runtime.fileIndexer.build({
      root: parsed.cwd,
    });
    process.stdout.write(`${formatIndexBuild(result)}\n`);
    process.exitCode = result.errors > 0 ? 1 : 0;
    return true;
  }

  if (parsed.kind === "status") {
    process.stdout.write(
      `${formatIndexStatus(runtime.fileIndexer.status())}\n`,
    );
    process.exitCode = 0;
    return true;
  }

  const hits = runtime.fileIndexer.search({
    query: parsed.query!,
    limit: parsed.limit,
  });
  process.stdout.write(`${formatIndexSearch(hits)}\n`);
  process.exitCode = 0;
  return true;
}
