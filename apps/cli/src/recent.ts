import type { AtlasDatabase, RecentFilesListQuery } from "@atlas-ai/database";

export interface ParsedRecentCommand {
  query: RecentFilesListQuery;
}

/**
 * Parse `recent` CLI / REPL commands.
 * Examples: recent | recent --limit 10 | recent --sort frequent
 */
export function parseRecentCommand(
  rawInput: string,
): ParsedRecentCommand | null {
  const tokens = rawInput.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens[0]!.toLowerCase() !== "recent") {
    return null;
  }

  const query: RecentFilesListQuery = { limit: 20, sort: "recent" };
  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (token === "--limit" || token === "-n") {
      const next = tokens[i + 1];
      if (!next) {
        throw new Error("Missing value for --limit");
      }
      query.limit = Number.parseInt(next, 10);
      if (!Number.isFinite(query.limit) || query.limit < 1) {
        throw new Error("--limit must be a positive integer");
      }
      i += 1;
      continue;
    }
    if (token === "--sort") {
      const next = tokens[i + 1];
      if (!next) {
        throw new Error("Missing value for --sort");
      }
      if (next !== "recent" && next !== "frequent") {
        throw new Error('--sort must be "recent" or "frequent"');
      }
      query.sort = next;
      i += 1;
      continue;
    }
    if (token === "--prefix" || token === "--path-prefix") {
      const next = tokens[i + 1];
      if (!next) {
        throw new Error("Missing value for --prefix");
      }
      query.pathPrefix = next;
      i += 1;
      continue;
    }
    if (token === "--action") {
      const next = tokens[i + 1];
      if (!next) {
        throw new Error("Missing value for --action");
      }
      if (next !== "read" && next !== "write") {
        throw new Error('--action must be "read" or "write"');
      }
      query.action = next;
      i += 1;
      continue;
    }
    if (token === "--since") {
      const next = tokens[i + 1];
      if (!next) {
        throw new Error("Missing value for --since");
      }
      query.since = next;
      i += 1;
      continue;
    }
    throw new Error(`Unknown recent option: ${token}`);
  }

  return { query };
}

export function formatRecentFiles(
  database: AtlasDatabase,
  query: RecentFilesListQuery,
): string {
  const rows = database.recentFiles.list(query);
  if (rows.length === 0) {
    return "No recent files recorded.";
  }

  const lines = [
    "path\tcount\taction\tlast_accessed_at",
    ...rows.map(
      (row) =>
        `${row.path}\t${row.accessCount}\t${row.lastAction}\t${row.lastAccessedAt}`,
    ),
  ];
  return lines.join("\n");
}
