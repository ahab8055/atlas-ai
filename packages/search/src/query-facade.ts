/**
 * Query façade for tools (ADR-0087) — CLI injects FileIndexingService.search.
 */
import type { IndexedFileSearchHit } from "@atlas-ai/database";

export interface FileIndexSearchStore {
  search(options: { query: string; limit?: number }): IndexedFileSearchHit[];
}

let store: FileIndexSearchStore | undefined;

export function setFileIndexSearchStore(
  next: FileIndexSearchStore | undefined,
): void {
  store = next;
}

export function getFileIndexSearchStore(): FileIndexSearchStore | undefined {
  return store;
}

export function __resetFileIndexSearchStoreForTests(): void {
  store = undefined;
}

export function searchIndexedFiles(options: {
  query: string;
  limit?: number;
}): IndexedFileSearchHit[] {
  if (!store) {
    return [];
  }
  return store.search(options);
}
