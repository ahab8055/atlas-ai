#!/usr/bin/env node
/**
 * CLI adapter: terminal → @atlas-ai/core → stdout (+ SQLite runtime data).
 *
 * Desktop and voice replace this adapter by calling the same
 * `createRequestHandler` / `handleRequest` with `source: "desktop" | "voice"`.
 */
import { exitCodeForResult } from "./display.js";
import { tryHandleAiCommand } from "./ai-command.js";
import { tryHandleHistoryCommand } from "./history-command.js";
import { tryHandleKnowledgeCommand } from "./knowledge-command.js";
import { tryHandleMemoryCommand } from "./memory-command.js";
import { tryHandleProfileCommand } from "./profile-command.js";
import { usage } from "./options.js";
import { parseCliArgs } from "./parse-args.js";
import { runRepl } from "./repl.js";
import { closeCliRuntime, createCliRuntime, runCommand } from "./run.js";

async function main(): Promise<void> {
  let options;
  try {
    options = parseCliArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 2;
    return;
  }

  if (options.showCliHelp) {
    process.stdout.write(`${usage()}\n`);
    process.exitCode = 0;
    return;
  }

  const hasCommand = options.commandArgs.length > 0;

  if (!hasCommand && !options.interactive) {
    process.stdout.write(`${usage()}\n`);
    process.exitCode = 0;
    return;
  }

  // AI commands use their own path; registry persistence still honors --db / --no-db.
  if (hasCommand && !options.interactive) {
    const rawInput = options.commandArgs.join(" ");
    if (
      await tryHandleAiCommand(rawInput, {
        enableDatabase: options.enableDatabase,
        databasePath: options.databasePath,
      })
    ) {
      return;
    }
  }

  const runtime = createCliRuntime(options);

  try {
    if (options.interactive) {
      if (hasCommand) {
        const initial = options.commandArgs.join(" ");
        if (
          await tryHandleAiCommand(initial, {
            enableDatabase: options.enableDatabase,
            databasePath: options.databasePath,
          })
        ) {
          // continue into REPL
        } else if (
          tryHandleHistoryCommand(runtime, initial) ||
          tryHandleMemoryCommand(runtime, initial) ||
          tryHandleKnowledgeCommand(runtime, initial) ||
          tryHandleProfileCommand(runtime, initial)
        ) {
          // continue into REPL
        } else {
          runCommand(runtime, options, initial);
        }
      }
      process.exitCode = await runRepl(options, runtime);
      return;
    }

    const rawInput = options.commandArgs.join(" ");
    if (
      tryHandleHistoryCommand(runtime, rawInput) ||
      tryHandleMemoryCommand(runtime, rawInput) ||
      tryHandleKnowledgeCommand(runtime, rawInput) ||
      tryHandleProfileCommand(runtime, rawInput)
    ) {
      return;
    }

    const result = runCommand(runtime, options, rawInput);
    process.exitCode = exitCodeForResult(result);
  } finally {
    closeCliRuntime(runtime);
  }
}

main().catch((error) => {
  process.stderr.write(
    `atlas: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
