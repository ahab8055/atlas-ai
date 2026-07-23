import type {
  IndexedFileSearchHit,
  IndexedFilesStatusSummary,
} from "@atlas-ai/database";
import type { IndexBuildResult } from "@atlas-ai/search";

export type IndexCommandKind = "build" | "status" | "search";

export interface ParsedIndexCommand {
  kind: IndexCommandKind;
  cwd?: string;
  query?: string;
  limit?: number;
}

/**
 * Parse `index` CLI / REPL commands.
 * Examples: index build | index status | index search hello --limit 10
 */
export function parseIndexCommand(rawInput: string): ParsedIndexCommand | null {
  const tokens = rawInput.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens[0]!.toLowerCase() !== "index") {
    return null;
  }

  const sub = tokens[1]?.toLowerCase();
  if (!sub || (sub !== "build" && sub !== "status" && sub !== "search")) {
    throw new Error(
      "Usage: index build [--cwd PATH] | index status | index search <query> [--limit N]",
    );
  }

  if (sub === "status") {
    if (tokens.length > 2) {
      throw new Error("index status takes no arguments");
    }
    return { kind: "status" };
  }

  if (sub === "build") {
    let cwd: string | undefined;
    for (let i = 2; i < tokens.length; i += 1) {
      const token = tokens[i]!;
      if (token === "--cwd") {
        const next = tokens[i + 1];
        if (!next) {
          throw new Error("Missing value for --cwd");
        }
        cwd = next;
        i += 1;
        continue;
      }
      throw new Error(`Unknown index build option: ${token}`);
    }
    return { kind: "build", cwd };
  }

  // search
  const queryParts: string[] = [];
  let limit: number | undefined;
  for (let i = 2; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (token === "--limit" || token === "-n") {
      const next = tokens[i + 1];
      if (!next) {
        throw new Error("Missing value for --limit");
      }
      limit = Number.parseInt(next, 10);
      if (!Number.isFinite(limit) || limit < 1) {
        throw new Error("--limit must be a positive integer");
      }
      i += 1;
      continue;
    }
    queryParts.push(token);
  }
  const query = queryParts.join(" ").trim();
  if (!query) {
    throw new Error("index search requires a query");
  }
  return { kind: "search", query, limit };
}

export function formatIndexBuild(result: IndexBuildResult): string {
  return [
    "Index build complete.",
    `scanned=${result.scanned} indexed=${result.indexed} unchanged=${result.unchanged} skipped=${result.skipped} errors=${result.errors}`,
  ].join("\n");
}

export function formatIndexStatus(summary: IndexedFilesStatusSummary): string {
  return [
    "File index status",
    `total=${summary.total} indexed=${summary.indexed} skipped=${summary.skipped} error=${summary.error} pending=${summary.pending}`,
    summary.lastIndexedAt
      ? `last_indexed_at=${summary.lastIndexedAt}`
      : "last_indexed_at=(none)",
  ].join("\n");
}

export function formatIndexSearch(hits: IndexedFileSearchHit[]): string {
  if (hits.length === 0) {
    return "No index hits.";
  }
  const lines = [
    "path\trank\tname\tsnippet",
    ...hits.map(
      (h) =>
        `${h.path}\t${h.rank}\t${h.name}\t${(h.snippet ?? "").replace(/\s+/g, " ")}`,
    ),
  ];
  return lines.join("\n");
}
