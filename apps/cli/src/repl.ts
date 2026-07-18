import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { tryHandleAiCommand } from "./ai-command.js";
import { exitCodeForResult } from "./display.js";
import { tryHandleHistoryCommand } from "./history-command.js";
import { tryHandleKnowledgeCommand } from "./knowledge-command.js";
import { tryHandleMemoryCommand } from "./memory-command.js";
import { tryHandleProfileCommand } from "./profile-command.js";
import type { CliOptions } from "./options.js";
import { createCliRuntime, runCommand, type CliRuntime } from "./run.js";

function isExitLine(line: string): boolean {
  const normalized = line.trim().toLowerCase();
  return (
    normalized === "exit" ||
    normalized === "quit" ||
    normalized === ":q" ||
    normalized === ".exit"
  );
}

/**
 * Interactive REPL — same core pipeline, persistent session + context.
 */
export async function runRepl(
  options: CliOptions,
  runtime: CliRuntime = createCliRuntime(options),
): Promise<number> {
  const rl = readline.createInterface({ input, output, terminal: true });

  process.stderr.write(
    [
      "Atlas interactive mode (core runtime).",
      `Session: ${options.sessionId}`,
      options.debug ? "Debug: on" : "Debug: off",
      'Type a command, or "exit" to leave.',
      "",
    ].join("\n"),
  );

  let lastCode = 0;

  try {
    for (;;) {
      const line = await rl.question("atlas> ");
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }
      if (isExitLine(trimmed)) {
        break;
      }

      if (
        await tryHandleAiCommand(trimmed, {
          enableDatabase: options.enableDatabase,
          databasePath: options.databasePath,
        })
      ) {
        lastCode =
          process.exitCode === 1 || process.exitCode === 2
            ? process.exitCode
            : 0;
        continue;
      }

      if (tryHandleHistoryCommand(runtime, trimmed)) {
        lastCode = process.exitCode === 2 ? 2 : 0;
        continue;
      }

      if (tryHandleMemoryCommand(runtime, trimmed)) {
        lastCode =
          process.exitCode === 1 || process.exitCode === 2
            ? process.exitCode
            : 0;
        continue;
      }

      if (tryHandleKnowledgeCommand(runtime, trimmed)) {
        lastCode =
          process.exitCode === 1 || process.exitCode === 2
            ? process.exitCode
            : 0;
        continue;
      }

      if (tryHandleProfileCommand(runtime, trimmed)) {
        lastCode =
          process.exitCode === 1 || process.exitCode === 2
            ? process.exitCode
            : 0;
        continue;
      }

      const result = runCommand(runtime, options, trimmed);
      lastCode = exitCodeForResult(result);
    }
  } finally {
    rl.close();
  }

  return lastCode;
}
