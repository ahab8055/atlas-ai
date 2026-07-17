/**
 * CLI: atlas memory — manage long-term memories (requires SQLite).
 */
import type { LongTermMemoryType } from "@atlas-ai/database";
import type { MemoryRecord } from "@atlas-ai/memory";

import type { CliRuntime } from "./run.js";

const LONG_TERM_TYPES = new Set(["episodic", "semantic", "procedural"]);

export function tryHandleMemoryCommand(
  runtime: CliRuntime,
  rawInput: string,
): boolean {
  const trimmed = rawInput.trim();
  if (!trimmed.toLowerCase().startsWith("memory")) {
    return false;
  }

  const tokens = tokenize(trimmed);
  if (tokens[0]?.toLowerCase() !== "memory") {
    return false;
  }

  if (!runtime.database || !runtime.longTermMemory) {
    process.stderr.write(
      "Long-term memory requires the database. Remove --no-db / ATLAS_DB_DISABLED.\n",
    );
    process.exitCode = 1;
    return true;
  }

  const ltm = runtime.longTermMemory;
  const sub = tokens[1]?.toLowerCase();

  try {
    if (!sub || sub === "help" || sub === "--help" || sub === "-h") {
      process.stdout.write(`${memoryUsage()}\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "list") {
      const type = readFlag(tokens, "--type") as LongTermMemoryType | undefined;
      if (type && !LONG_TERM_TYPES.has(type)) {
        throw new Error(`Invalid --type (use episodic|semantic|procedural)`);
      }
      const limit = Number(readFlag(tokens, "--limit") ?? "50");
      const rows = ltm.list({
        type,
        limit: Number.isFinite(limit) ? limit : 50,
      });
      process.stdout.write(`${formatMemoryList(rows)}\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "add") {
      const type = (readFlag(tokens, "--type") ??
        "semantic") as LongTermMemoryType;
      if (!LONG_TERM_TYPES.has(type)) {
        throw new Error(`Invalid --type (use episodic|semantic|procedural)`);
      }
      const importanceRaw = readFlag(tokens, "--importance");
      const importance =
        importanceRaw !== undefined ? Number(importanceRaw) : undefined;
      const content = positionalArgs(tokens, 2)
        .filter((t) => !t.startsWith("--"))
        .join(" ")
        .trim();
      // Also support: memory add --type semantic -- content...
      const contentFromFlag = readFlag(tokens, "--content");
      const finalContent = (contentFromFlag ?? content).trim();
      if (!finalContent) {
        throw new Error('Usage: memory add --type <type> "content"');
      }
      const stored = ltm.store({
        type,
        content: finalContent,
        importance: Number.isFinite(importance) ? importance : undefined,
      });
      process.stdout.write(`Stored ${stored.type} memory ${stored.id}\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "get") {
      const id = tokens[2];
      if (!id) {
        throw new Error("Usage: memory get <id>");
      }
      const row = ltm.get(id);
      if (!row) {
        process.stderr.write(`Memory not found: ${id}\n`);
        process.exitCode = 1;
        return true;
      }
      process.stdout.write(`${formatMemoryDetail(row)}\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "update") {
      const id = tokens[2];
      if (!id) {
        throw new Error('Usage: memory update <id> --content "..."');
      }
      const content = readFlag(tokens, "--content");
      const importanceRaw = readFlag(tokens, "--importance");
      if (content === undefined && importanceRaw === undefined) {
        throw new Error("Provide --content and/or --importance");
      }
      const updated = ltm.update(id, {
        content,
        importance:
          importanceRaw !== undefined ? Number(importanceRaw) : undefined,
      });
      process.stdout.write(`Updated memory ${updated.id}\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "delete") {
      const id = tokens[2];
      if (!id) {
        throw new Error("Usage: memory delete <id>");
      }
      const ok = ltm.delete(id);
      if (!ok) {
        process.stderr.write(`Memory not found: ${id}\n`);
        process.exitCode = 1;
        return true;
      }
      process.stdout.write(`Deleted memory ${id}\n`);
      process.exitCode = 0;
      return true;
    }

    if (sub === "search") {
      const query = positionalArgs(tokens, 2).join(" ").trim();
      if (!query) {
        throw new Error('Usage: memory search "query"');
      }
      const type = readFlag(tokens, "--type") as LongTermMemoryType | undefined;
      const limit = Number(readFlag(tokens, "--limit") ?? "5");
      const hits = ltm.search(query, {
        type,
        limit: Number.isFinite(limit) ? limit : 5,
      });
      process.stdout.write(`${formatMemoryList(hits)}\n`);
      process.exitCode = 0;
      return true;
    }

    throw new Error(`Unknown memory subcommand: ${sub}\n${memoryUsage()}`);
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 2;
    return true;
  }
}

function memoryUsage(): string {
  return [
    "atlas memory — long-term memory (requires database)",
    "",
    "  atlas memory list [--type episodic|semantic|procedural] [--limit N]",
    '  atlas memory add --type semantic "content" [--importance 0.9]',
    "  atlas memory get <id>",
    '  atlas memory update <id> --content "..." [--importance 0.8]',
    "  atlas memory delete <id>",
    '  atlas memory search "query" [--type …] [--limit N]',
  ].join("\n");
}

function formatMemoryList(rows: MemoryRecord[]): string {
  if (rows.length === 0) {
    return "(no memories)";
  }
  return rows
    .map(
      (r) =>
        `${r.id}  [${r.type}]  ${truncate(r.content, 80)}` +
        (r.importance !== undefined ? `  imp=${r.importance}` : ""),
    )
    .join("\n");
}

function formatMemoryDetail(row: MemoryRecord): string {
  return [
    `id: ${row.id}`,
    `type: ${row.type}`,
    `scope: ${row.scope}`,
    `content: ${row.content}`,
    `importance: ${row.importance ?? ""}`,
    `confidence: ${row.confidence ?? ""}`,
    `tags: ${(row.tags ?? []).join(", ")}`,
    `created: ${row.createdAt}`,
    `updated: ${row.updatedAt}`,
  ].join("\n");
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}…`;
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(input)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3] ?? "");
  }
  return tokens;
}

function readFlag(tokens: string[], name: string): string | undefined {
  const idx = tokens.indexOf(name);
  if (idx === -1) {
    return undefined;
  }
  return tokens[idx + 1];
}

function positionalArgs(tokens: string[], start: number): string[] {
  const out: string[] = [];
  for (let i = start; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (t.startsWith("--")) {
      i += 1; // skip flag value
      continue;
    }
    out.push(t);
  }
  return out;
}

/** Exported for tests. */
export function __testOnly() {
  return { tokenize, readFlag, formatMemoryList, memoryUsage };
}
