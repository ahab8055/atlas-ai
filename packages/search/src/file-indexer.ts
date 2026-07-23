/**
 * File indexing service (ADR-0087 / Architecture/24 keyword slice).
 */
import { createHash } from "node:crypto";
import path from "node:path";

import type {
  AtlasDatabase,
  IndexedFileSearchHit,
  IndexedFilesStatusSummary,
} from "@atlas-ai/database";
import type { Logger } from "@atlas-ai/logging";
import {
  fileExtension,
  formatFromExtension,
  isUnsupportedBinaryFormat,
  type FileAccessService,
  type FileFormat,
  type FileSystemEventPayloadMap,
  type FileSystemEventType,
} from "@atlas-ai/filesystem";

const DEFAULT_MAX_CONTENT_BYTES = 256 * 1024;

const INDEXABLE_FORMATS = new Set<FileFormat>([
  "text",
  "markdown",
  "json",
  "yaml",
  "csv",
  "source",
  "xml",
]);

export interface SemanticIndexSink {
  onFileIndexed(input: {
    path: string;
    content: string;
    contentHash: string;
  }): void;
  onFileRemoved(path: string): void;
}

export interface FileIndexingServiceOptions {
  database: AtlasDatabase;
  files: FileAccessService;
  logger?: Logger;
  semanticSink?: SemanticIndexSink;
  maxContentBytes?: number;
  projectId?: string;
  userId?: string;
}

export interface IndexBuildOptions {
  root?: string;
  maxDepth?: number;
}

export interface IndexBuildResult {
  scanned: number;
  indexed: number;
  skipped: number;
  errors: number;
  unchanged: number;
}

export interface FileIndexSearchOptions {
  query: string;
  limit?: number;
}

export interface FileIndexingService {
  build(options?: IndexBuildOptions): IndexBuildResult;
  indexPath(
    absoluteOrRelativePath: string,
  ): "indexed" | "skipped" | "error" | "unchanged";
  removePath(absoluteOrRelativePath: string): boolean;
  applyFsEvent(
    type: FileSystemEventType,
    payload: FileSystemEventPayloadMap[FileSystemEventType],
  ): void;
  search(options: FileIndexSearchOptions): IndexedFileSearchHit[];
  status(): IndexedFilesStatusSummary;
}

function sha256Hex(data: Uint8Array | string): string {
  const hash = createHash("sha256");
  hash.update(typeof data === "string" ? data : Buffer.from(data));
  return hash.digest("hex");
}

const NOOP_SINK: SemanticIndexSink = {
  onFileIndexed() {},
  onFileRemoved() {},
};

export function createFileIndexingService(
  options: FileIndexingServiceOptions,
): FileIndexingService {
  const database = options.database;
  const files = options.files;
  const logger = options.logger;
  const sink = options.semanticSink ?? NOOP_SINK;
  const maxContentBytes = options.maxContentBytes ?? DEFAULT_MAX_CONTENT_BYTES;
  const userId = options.userId ?? "local";
  const projectId = options.projectId;

  function resolvePath(input: string): string {
    return files.resolvePath(input);
  }

  function indexPath(
    absoluteOrRelativePath: string,
  ): "indexed" | "skipped" | "error" | "unchanged" {
    let absolute: string;
    try {
      absolute = resolvePath(absoluteOrRelativePath);
    } catch (error) {
      logger?.warn(
        `indexPath resolve failed: ${absoluteOrRelativePath} (${error instanceof Error ? error.message : String(error)})`,
      );
      return "error";
    }

    try {
      const exists = files.pathExists(absolute);
      if (!exists.exists) {
        database.indexedFiles.remove(absolute, userId);
        sink.onFileRemoved(absolute);
        return "skipped";
      }
      if (exists.isDirectory) {
        return "skipped";
      }

      const meta = files.getFileMetadata(absolute);
      const ext = meta.extension || fileExtension(meta.name);
      const format = formatFromExtension(ext);

      if (isUnsupportedBinaryFormat(format) || !INDEXABLE_FORMATS.has(format)) {
        database.indexedFiles.upsertWithContent({
          path: absolute,
          name: meta.name,
          extension: ext || null,
          size: meta.size,
          mtimeMs: meta.modifiedAtMs,
          contentHash: null,
          content: "",
          projectId: projectId ?? null,
          status: "skipped",
          errorMessage: `format not indexable: ${format}`,
          userId,
        });
        return "skipped";
      }

      const read = files.readFile(absolute, {
        maxBytes: maxContentBytes,
        parse: false,
      });
      const contentHash = sha256Hex(read.content);
      const existing = database.indexedFiles.getByPath(absolute, userId);
      if (
        existing?.status === "indexed" &&
        existing.contentHash === contentHash
      ) {
        return "unchanged";
      }

      database.indexedFiles.upsertWithContent({
        path: absolute,
        name: meta.name,
        extension: ext || null,
        size: meta.size,
        mtimeMs: meta.modifiedAtMs,
        contentHash,
        content: read.content,
        projectId: projectId ?? null,
        status: "indexed",
        errorMessage: null,
        userId,
      });

      try {
        sink.onFileIndexed({
          path: absolute,
          content: read.content,
          contentHash,
        });
      } catch {
        // best-effort
      }

      return "indexed";
    } catch (error) {
      const name = path.basename(absolute);
      database.indexedFiles.upsertWithContent({
        path: absolute,
        name,
        content: "",
        status: "error",
        errorMessage: error instanceof Error ? error.message : String(error),
        userId,
        projectId: projectId ?? null,
      });
      logger?.warn(
        `indexPath failed: ${absolute} (${error instanceof Error ? error.message : String(error)})`,
      );
      return "error";
    }
  }

  function removePath(absoluteOrRelativePath: string): boolean {
    let absolute: string;
    try {
      absolute = resolvePath(absoluteOrRelativePath);
    } catch {
      absolute = path.resolve(absoluteOrRelativePath);
    }
    const removed = database.indexedFiles.remove(absolute, userId);
    if (removed) {
      try {
        sink.onFileRemoved(absolute);
      } catch {
        // best-effort
      }
    }
    return removed;
  }

  function build(buildOptions: IndexBuildOptions = {}): IndexBuildResult {
    const result: IndexBuildResult = {
      scanned: 0,
      indexed: 0,
      skipped: 0,
      errors: 0,
      unchanged: 0,
    };

    const entries = files.walkDirectory(buildOptions.root, {
      maxDepth: buildOptions.maxDepth,
      respectIgnore: true,
      includeHidden: false,
      limit: 50_000,
    });

    for (const entry of entries) {
      if (!entry.isFile || entry.isSymbolicLink) {
        continue;
      }
      result.scanned += 1;
      const outcome = indexPath(entry.path);
      if (outcome === "indexed") result.indexed += 1;
      else if (outcome === "skipped") result.skipped += 1;
      else if (outcome === "error") result.errors += 1;
      else result.unchanged += 1;
    }

    return result;
  }

  function applyFsEvent(
    type: FileSystemEventType,
    payload: FileSystemEventPayloadMap[FileSystemEventType],
  ): void {
    if (type === "FileRenamed") {
      const renamed = payload as FileSystemEventPayloadMap["FileRenamed"];
      removePath(renamed.from);
      if (!renamed.isDirectory) {
        indexPath(renamed.to);
      }
      return;
    }

    if (type === "FileDeleted") {
      const del = payload as FileSystemEventPayloadMap["FileDeleted"];
      if (del.isDirectory) {
        database.indexedFiles.removeByPrefix(del.path, userId);
        try {
          sink.onFileRemoved(del.path);
        } catch {
          // best-effort
        }
      } else {
        removePath(del.path);
      }
      return;
    }

    if (type === "FolderChanged") {
      // Best-effort: if folder gone, clear prefix; otherwise leave to create/update events
      const folder = payload as FileSystemEventPayloadMap["FolderChanged"];
      try {
        const exists = files.pathExists(folder.path);
        if (!exists.exists) {
          database.indexedFiles.removeByPrefix(folder.path, userId);
        }
      } catch {
        // ignore
      }
      return;
    }

    if (type === "FileCreated" || type === "FileUpdated") {
      const file = payload as FileSystemEventPayloadMap["FileCreated"];
      if (file.isDirectory) {
        return;
      }
      indexPath(file.path);
    }
  }

  return {
    build,
    indexPath,
    removePath,
    applyFsEvent,
    search(searchOptions) {
      return database.indexedFiles.searchFts({
        query: searchOptions.query,
        limit: searchOptions.limit,
        userId,
      });
    },
    status() {
      return database.indexedFiles.statusSummary(userId);
    },
  };
}
