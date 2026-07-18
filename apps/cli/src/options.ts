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
  /** Show help for the CLI itself (not the atlas help intent). */
  showCliHelp: boolean;
  /**
   * When false, skip SQLite (rare; tests). Default true — DB initializes automatically.
   */
  enableDatabase: boolean;
  /** Override SQLite path (default `.data/atlas.sqlite` or `ATLAS_DB_PATH`). */
  databasePath?: string;
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
    "  --db <path>           SQLite database path (default: .data/atlas.sqlite)",
    "  --no-db               Disable SQLite for this run",
    "  -h, --help            Show this CLI help",
    "",
    "Examples:",
    "  atlas help",
    "  atlas status",
    "  atlas ai status",
    '  atlas ai ask "hello"',
    "  atlas history",
    "  atlas history --status failed --limit 5",
    '  atlas memory add --type semantic "Prefers TypeScript"',
    '  atlas memory search "TypeScript"',
    "  atlas knowledge entity add --type project --name Atlas",
    '  atlas knowledge extract --store "using TypeScript"',
    "  atlas knowledge link --from <id> --to <id> --type uses",
    '  atlas knowledge retrieve "Atlas TypeScript"',
    "  atlas knowledge traverse <entityId>",
    "  atlas profile set preferred_editor Cursor",
    "  atlas profile list",
    '  atlas profile learn "I prefer concise answers"',
    "  atlas project detect",
    "  atlas project status",
    "  atlas echo hello",
    '  atlas --debug "Open VS Code"',
    "  atlas -i",
    "",
    "Env:",
    "  ATLAS_CLI_QUIET=1     Same as --quiet",
    "  ATLAS_CLI_DEBUG=1     Same as --debug",
    "  ATLAS_DB_PATH=…       Default database file path",
    "  ATLAS_DB_DISABLED=1   Same as --no-db",
    "  ATLAS_LOG_LEVEL=…     Default log level when not --debug/--quiet",
    "  ATLAS_AI_PROVIDER=…   mock | llamacpp",
    "  ATLAS_AI_ENDPOINT=…   llama-server base URL",
    "  ATLAS_AI_DEFAULT_MODEL=…",
    "",
    "Desktop and voice will call the same core handler with source desktop|voice.",
  ].join("\n");
}
