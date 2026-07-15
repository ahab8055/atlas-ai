/**
 * CLI options — thin adapter flags; core never depends on these.
 */
export interface CliOptions {
  /** Remaining argv joined into the user command (empty in interactive-only). */
  commandArgs: string[];
  /** Interactive REPL mode. */
  interactive: boolean;
  /** Hide pipeline logs; print response only. */
  quiet: boolean;
  /**
   * Debug mode: verbose logs, orchestration events on stderr,
   * and a compact result meta block after the response.
   */
  debug: boolean;
  /** Conversation session id (shared across REPL turns). */
  sessionId: string;
  /** Show help for the CLI itself (not atlas help intent). */
  showCliHelp: boolean;
}

export function usage(): string {
  return [
    "Atlas AI CLI — terminal adapter for the core runtime",
    "",
    "Usage:",
    "  atlas [options] <command…>",
    "  atlas [options] --interactive",
    "",
    "Options:",
    "  -i, --interactive     Open a REPL (same core pipeline, persistent session)",
    "  -d, --debug           Debug mode: events + stage logs + result meta on stderr",
    "  -q, --quiet           Response only (no stage logs)",
    "  --session <id>        Set conversation session id",
    "  -h, --help            Show this CLI help",
    "",
    "Examples:",
    "  atlas help",
    "  atlas status",
    "  atlas echo hello",
    '  atlas --debug "Open VS Code"',
    "  atlas -i",
    "",
    "Env:",
    "  ATLAS_CLI_QUIET=1     Same as --quiet",
    "  ATLAS_CLI_DEBUG=1     Same as --debug",
    "  ATLAS_LOG_LEVEL=…     Default log level when not --debug/--quiet",
    "",
    "Desktop and voice will call the same core handler with source desktop|voice.",
  ].join("\n");
}
