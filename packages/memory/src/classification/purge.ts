/**
 * Purge long-term memories whose metadata.expiresAt is in the past.
 */
import type { MemoriesRepository } from "@atlas-ai/database";

export interface PurgeExpiredResult {
  scanned: number;
  deleted: number;
  ids: string[];
}

export function purgeExpiredMemories(
  repo: MemoriesRepository,
  now: () => number = () => Date.now(),
  options: { limit?: number; userId?: string } = {},
): PurgeExpiredResult {
  const limit = options.limit ?? 500;
  const rows = repo.list({
    userId: options.userId,
    limit,
  });
  const cutoff = now();
  const ids: string[] = [];

  for (const row of rows) {
    const raw = row.metadata?.expiresAt;
    if (typeof raw !== "string" || !raw.trim()) {
      continue;
    }
    const ts = Date.parse(raw);
    if (!Number.isFinite(ts) || ts > cutoff) {
      continue;
    }
    if (repo.delete(row.id)) {
      ids.push(row.id);
    }
  }

  return {
    scanned: rows.length,
    deleted: ids.length,
    ids,
  };
}
