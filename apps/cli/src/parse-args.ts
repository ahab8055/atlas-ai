import { usage, type CliOptions } from "./options.js";

/**
 * Parse CLI argv into options + command tokens.
 * Supports pnpm's leading `--` separator.
 */
export function parseCliArgs(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env,
): CliOptions {
  const tokens = argv.filter((arg, index) => !(index === 0 && arg === "--"));

  let interactive = false;
  let quiet = env.ATLAS_CLI_QUIET === "1";
  let debug = env.ATLAS_CLI_DEBUG === "1";
  let sessionId = env.ATLAS_CLI_SESSION ?? "cli-default";
  let showCliHelp = false;
  let enableDatabase = env.ATLAS_DB_DISABLED !== "1";
  let databasePath = env.ATLAS_DB_PATH;
  const commandArgs: string[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;

    // After the command starts, keep remaining tokens (including flags like --limit).
    if (commandArgs.length > 0) {
      commandArgs.push(token);
      continue;
    }

    switch (token) {
      case "-h":
      case "--help":
        showCliHelp = true;
        break;
      case "-i":
      case "--interactive":
        interactive = true;
        break;
      case "-q":
      case "--quiet":
        quiet = true;
        break;
      case "-d":
      case "--debug":
        debug = true;
        break;
      case "--no-db":
        enableDatabase = false;
        break;
      case "--db": {
        const next = tokens[i + 1];
        if (!next || next.startsWith("-")) {
          throw new Error("Missing value for --db <path>");
        }
        databasePath = next;
        i += 1;
        break;
      }
      case "--session": {
        const next = tokens[i + 1];
        if (!next || next.startsWith("-")) {
          throw new Error("Missing value for --session <id>");
        }
        sessionId = next;
        i += 1;
        break;
      }
      default:
        if (token.startsWith("-")) {
          throw new Error(`Unknown option: ${token}\n\n${usage()}`);
        }
        commandArgs.push(token);
        break;
    }
  }

  if (debug) {
    quiet = false;
  }

  return {
    commandArgs,
    interactive,
    quiet,
    debug,
    sessionId,
    showCliHelp,
    enableDatabase,
    databasePath,
  };
}
