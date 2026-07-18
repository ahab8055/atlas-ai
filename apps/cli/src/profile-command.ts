/**
 * CLI: atlas profile — manage structured user preferences.
 */
import type { ProfilePreference } from "@atlas-ai/profile";

import type { CliRuntime } from "./run.js";

export function tryHandleProfileCommand(
  runtime: CliRuntime,
  rawInput: string,
): boolean {
  const trimmed = rawInput.trim();
  if (!trimmed.toLowerCase().startsWith("profile")) {
    return false;
  }

  const tokens = tokenize(trimmed);
  if (tokens[0]?.toLowerCase() !== "profile") {
    return false;
  }

  const sub = tokens[1]?.toLowerCase();

  if (sub === "learn") {
    return handleLearn(runtime, tokens.slice(2));
  }

  if (!runtime.database || !runtime.profile) {
    process.stderr.write(
      "Profile requires the database. Remove --no-db / ATLAS_DB_DISABLED.\n",
    );
    process.exitCode = 1;
    return true;
  }

  const profile = runtime.profile;

  try {
    if (!sub || sub === "help" || sub === "--help" || sub === "-h") {
      process.stdout.write(`${profileUsage()}\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "list") {
      const category = readFlag(tokens, "--category");
      const rows = profile.list({
        category: category || undefined,
        enabledOnly: false,
      });
      process.stdout.write(`${formatPreferenceList(rows)}\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "get") {
      const key = tokens[2];
      if (!key) {
        throw new Error("Usage: profile get <key>");
      }
      const row = profile.get(key);
      if (!row) {
        process.stdout.write("(not set)\n");
        process.exitCode = 0;
        return true;
      }
      process.stdout.write(`${formatPreferenceDetail(row)}\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "set") {
      const key = tokens[2];
      const value = positionalArgs(tokens, 3).join(" ").trim();
      if (!key || !value) {
        throw new Error("Usage: profile set <key> <value> [--category coding]");
      }
      const category = readFlag(tokens, "--category");
      const row = profile.set(key, value, {
        category: category || undefined,
        source: "manual",
      });
      process.stdout.write(`Set ${row.key}=${row.value} [${row.category}]\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "delete") {
      const key = tokens[2];
      if (!key) {
        throw new Error("Usage: profile delete <key>");
      }
      const ok = profile.delete(key);
      process.stdout.write(ok ? `Deleted ${key}\n` : `(not found)\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "disable" || sub === "enable") {
      const key = tokens[2];
      if (!key) {
        throw new Error(`Usage: profile ${sub} <key>`);
      }
      const row = profile.setEnabled(key, sub === "enable");
      if (!row) {
        process.stdout.write("(not found)\n");
      } else {
        process.stdout.write(
          `${row.key} ${row.enabled ? "enabled" : "disabled"}\n`,
        );
      }
      process.exitCode = 0;
      return true;
    }

    throw new Error(`Unknown profile subcommand: ${sub}\n${profileUsage()}`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 2;
    return true;
  }
}

function handleLearn(runtime: CliRuntime, args: string[]): boolean {
  if (!runtime.database || !runtime.profile) {
    process.stderr.write(
      "Profile learn requires the database. Remove --no-db / ATLAS_DB_DISABLED.\n",
    );
    process.exitCode = 1;
    return true;
  }

  try {
    const text = args.join(" ").trim();
    if (!text) {
      throw new Error('Usage: profile learn "I prefer Cursor"');
    }
    const learning = runtime.config.profile?.learning ?? {
      enabled: true,
      learnOnRequest: true,
      minConfidence: 0.55,
    };
    if (!learning.enabled) {
      process.stderr.write("Profile learning is disabled in config.\n");
      process.exitCode = 1;
      return true;
    }
    const result = runtime.profile.learnFromText(text, {
      minConfidence: learning.minConfidence,
    });
    process.stdout.write(
      `candidates: ${result.candidates.length}\nstored: ${result.stored.length}\n`,
    );
    for (const row of result.stored) {
      process.stdout.write(
        `${row.confidence.toFixed(2)}  [${row.category}]  ${row.key}=${row.value}\n`,
      );
    }
    process.exitCode = 0;
    return true;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 2;
    return true;
  }
}

function profileUsage(): string {
  return [
    "atlas profile — user preferences",
    "",
    "  atlas profile list [--category coding]",
    "  atlas profile get <key>",
    "  atlas profile set <key> <value> [--category …]",
    "  atlas profile delete <key>",
    "  atlas profile disable <key>",
    "  atlas profile enable <key>",
    '  atlas profile learn "I prefer Cursor and concise answers"',
  ].join("\n");
}

function formatPreferenceList(rows: ProfilePreference[]): string {
  if (rows.length === 0) {
    return "(no preferences)";
  }
  return rows
    .map(
      (r) =>
        `${r.enabled ? "on " : "off"}  [${r.category}]  ${r.key}=${r.value}` +
        `  (${r.source}, c=${r.confidence.toFixed(2)})`,
    )
    .join("\n");
}

function formatPreferenceDetail(row: ProfilePreference): string {
  return [
    `key: ${row.key}`,
    `value: ${row.value}`,
    `category: ${row.category}`,
    `source: ${row.source}`,
    `confidence: ${row.confidence}`,
    `enabled: ${row.enabled}`,
    `updated: ${row.updatedAt}`,
  ].join("\n");
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    tokens.push(m[1] ?? m[2] ?? m[3] ?? "");
  }
  return tokens;
}

function readFlag(tokens: string[], flag: string): string | undefined {
  const i = tokens.indexOf(flag);
  if (i < 0 || i + 1 >= tokens.length) {
    return undefined;
  }
  return tokens[i + 1];
}

function positionalArgs(tokens: string[], start: number): string[] {
  const out: string[] = [];
  for (let i = start; i < tokens.length; i += 1) {
    const t = tokens[i]!;
    if (t.startsWith("--")) {
      i += 1;
      continue;
    }
    out.push(t);
  }
  return out;
}

/** Exposed for tests. */
export function _testOnly(): { profileUsage: () => string } {
  return { profileUsage };
}
