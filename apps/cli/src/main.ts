#!/usr/bin/env node
/**
 * CLI adapter: terminal → @atlas-ai/core → stdout.
 *
 * Desktop and voice replace this adapter by calling the same
 * `createRequestHandler` / `handleRequest` with `source: "desktop" | "voice"`.
 */
import { usage } from "./options.js";
import { parseCliArgs } from "./parse-args.js";
import { runRepl } from "./repl.js";
import { createCliRuntime, runCommand } from "./run.js";
import { exitCodeForResult } from "./display.js";

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

  const runtime = createCliRuntime(options);

  if (options.interactive) {
    if (hasCommand) {
      // Optional: run initial command then enter REPL
      runCommand(runtime, options, options.commandArgs.join(" "));
    }
    process.exitCode = await runRepl(options, runtime);
    return;
  }

  const result = runCommand(runtime, options, options.commandArgs.join(" "));
  process.exitCode = exitCodeForResult(result);
}

main().catch((error) => {
  process.stderr.write(
    `atlas: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
