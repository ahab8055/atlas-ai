#!/usr/bin/env node
/**
 * CLI adapter: argv → @atlas-ai/core pipeline → stdout.
 * Desktop and voice will call the same handler with a different InputSource.
 */
import { createRequestHandler } from "@atlas-ai/core";
import {
  createLogger,
  formatLogRecord,
  parseLogLevel,
  type LogSink,
} from "@atlas-ai/logging";

function usage(): string {
  return [
    "Usage: atlas <command>",
    "",
    "Examples:",
    "  atlas help",
    "  atlas status",
    "  atlas echo hello",
  ].join("\n");
}

/** Keep stage logs off stdout so the command response stays scriptable. */
function createStderrSink(): LogSink {
  return {
    write(record) {
      process.stderr.write(`${formatLogRecord(record)}\n`);
    },
  };
}

function main(): void {
  const args = process.argv.slice(2).filter((arg, index) => {
    // pnpm sometimes forwards a leading "--" separator.
    return !(index === 0 && arg === "--");
  });
  if (args.length === 0) {
    process.stdout.write(`${usage()}\n`);
    process.exitCode = 0;
    return;
  }

  const rawInput = args.join(" ");
  const quiet = process.env.ATLAS_CLI_QUIET === "1";
  const level = parseLogLevel(process.env.ATLAS_LOG_LEVEL);

  const logger = createLogger({
    service: "atlas-cli",
    level: quiet ? "error" : level,
    category: "application",
    sink: createStderrSink(),
  });

  const handler = createRequestHandler({ logger });
  const result = handler.handle({
    source: "cli",
    rawInput,
    metadata: { argv: args },
  });

  process.stdout.write(`${result.response.text}\n`);
  if (result.response.status !== "completed") {
    process.exitCode = 1;
  }
}

main();
