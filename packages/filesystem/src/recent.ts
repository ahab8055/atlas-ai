/**
 * Recent files query façade (ADR-0085).
 * CLI injects a SQLite-backed store; tools call listRecentFiles without DB deps.
 */

export type RecentFileAccessAction = "read" | "write";

export interface RecentFileEntry {
  path: string;
  lastAction: RecentFileAccessAction;
  lastAccessedAt: string;
  accessCount: number;
}

export type RecentFilesSort = "recent" | "frequent";

export interface RecentFilesListOptions {
  limit?: number;
  offset?: number;
  sort?: RecentFilesSort;
  pathPrefix?: string;
  action?: RecentFileAccessAction;
  since?: string;
}

export interface RecentFilesStore {
  list(options?: RecentFilesListOptions): RecentFileEntry[];
}

let store: RecentFilesStore | undefined;

export function setRecentFilesStore(next: RecentFilesStore | undefined): void {
  store = next;
}

export function getRecentFilesStore(): RecentFilesStore | undefined {
  return store;
}

export function __resetRecentFilesStoreForTests(): void {
  store = undefined;
}

export function listRecentFiles(
  options: RecentFilesListOptions = {},
): RecentFileEntry[] {
  if (!store) {
    return [];
  }
  return store.list(options);
}
