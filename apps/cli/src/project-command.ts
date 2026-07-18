/**
 * CLI: atlas project — workspace / project awareness.
 */
import type { ProjectRow } from "@atlas-ai/database";

import type { CliRuntime } from "./run.js";

export function tryHandleProjectCommand(
  runtime: CliRuntime,
  rawInput: string,
): boolean {
  const trimmed = rawInput.trim();
  if (!trimmed.toLowerCase().startsWith("project")) {
    return false;
  }

  const tokens = tokenize(trimmed);
  if (tokens[0]?.toLowerCase() !== "project") {
    return false;
  }

  const sub = tokens[1]?.toLowerCase();

  if (!runtime.database || !runtime.workspace) {
    process.stderr.write(
      "Project commands require the database. Remove --no-db / ATLAS_DB_DISABLED.\n",
    );
    process.exitCode = 1;
    return true;
  }

  const workspace = runtime.workspace;

  try {
    if (!sub || sub === "help" || sub === "--help" || sub === "-h") {
      process.stdout.write(`${projectUsage()}\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "detect") {
      const cwd = readFlag(tokens, "--cwd") ?? process.cwd();
      const remember =
        runtime.config.workspace?.rememberOnDetect !== false &&
        !tokens.includes("--no-remember");
      const detected = workspace.detect(cwd);
      if (!detected) {
        process.stdout.write("(no project root found)\n");
        process.exitCode = 0;
        return true;
      }
      process.stdout.write(
        `detected: ${detected.name}\npath: ${detected.rootPath}\nkind: ${detected.kind}\n`,
      );
      if (detected.repoUrl) {
        process.stdout.write(`repo: ${detected.repoUrl}\n`);
      }
      if (remember) {
        const row = workspace.detectAndRegister({ cwd, remember: true });
        if (row) {
          process.stdout.write(`registered: ${row.id}\n`);
        }
      }
      process.exitCode = 0;
      return true;
    }

    if (sub === "list") {
      const rows = workspace.list();
      process.stdout.write(
        `${formatProjectList(rows, workspace.getActive()?.id)}\n`,
      );
      process.exitCode = 0;
      return true;
    }

    if (sub === "get") {
      const id = tokens[2];
      if (!id) {
        throw new Error("Usage: project get <id>");
      }
      const row = workspace.get(id) ?? workspace.getByPath(id);
      if (!row) {
        process.stdout.write("(not found)\n");
        process.exitCode = 0;
        return true;
      }
      process.stdout.write(`${formatProjectDetail(row)}\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "use") {
      const idOrPath = tokens[2];
      if (!idOrPath) {
        throw new Error("Usage: project use <id|path>");
      }
      const row = workspace.setActive(idOrPath);
      if (!row) {
        process.stdout.write("(not found)\n");
        process.exitCode = 1;
        return true;
      }
      process.stdout.write(`Active: ${row.name} (${row.path})\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "status") {
      const active = workspace.getActive();
      if (!active) {
        process.stdout.write("(no active project)\n");
        process.exitCode = 0;
        return true;
      }
      process.stdout.write(`${formatProjectDetail(active)}\n`);
      process.exitCode = 0;
      return true;
    }

    throw new Error(`Unknown project subcommand: ${sub}\n${projectUsage()}`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 2;
    return true;
  }
}

function projectUsage(): string {
  return [
    "atlas project — workspace awareness",
    "",
    "  atlas project detect [--cwd PATH] [--no-remember]",
    "  atlas project list",
    "  atlas project get <id>",
    "  atlas project use <id|path>",
    "  atlas project status",
  ].join("\n");
}

function formatProjectList(rows: ProjectRow[], activeId?: string): string {
  if (rows.length === 0) {
    return "(no projects)";
  }
  return rows
    .map((r) => {
      const mark = r.id === activeId ? "*" : " ";
      return `${mark} ${r.id}  ${r.name}  ${r.path}`;
    })
    .join("\n");
}

function formatProjectDetail(row: ProjectRow): string {
  return [
    `id: ${row.id}`,
    `name: ${row.name}`,
    `path: ${row.path}`,
    `repo: ${row.repoUrl ?? "(none)"}`,
    `branch: ${row.defaultBranch ?? "(unknown)"}`,
    `lastSeen: ${row.lastSeenAt}`,
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
