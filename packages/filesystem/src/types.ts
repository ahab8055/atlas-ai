/**
 * Product File System Access types (Architecture/26 §3).
 * Distinct from platform FileSystemService (os.files CRUD).
 */

export interface FileHit {
  path: string;
  name: string;
  match?: "name" | "content";
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink?: boolean;
  size?: number;
  mtimeMs?: number;
  /** Lowercase extension including leading dot, e.g. `.ts` (empty if none). */
  extension?: string;
}

export interface FindFilesQuery {
  /** Basename glob (`*` and `?` wildcards). */
  pattern: string;
  /** Search root (must be inside configured roots). Defaults to first root. */
  root?: string;
  /** Also scan file contents (size-capped). */
  content?: boolean;
  /** Max hits to return (default 50). */
  limit?: number;
  /** Max recursion depth (default service maxDepth). */
  maxDepth?: number;
  /** Include names starting with `.` (default false). */
  includeHidden?: boolean;
  /** Filter by extension, e.g. `[".ts", "md"]` (normalized, case-insensitive). */
  extensions?: string[];
  /** When true (default), directories are excluded from hits. */
  filesOnly?: boolean;
  /** Apply ignore rules engine (default true). */
  respectIgnore?: boolean;
}

export interface FileSearchResult {
  hits: FileHit[];
  /** True when hit `limit` was reached. */
  truncated: boolean;
  /** Entries considered during the walk. */
  scannedEntries: number;
  durationMs: number;
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
  format: FileFormat;
  mimeType: string;
  encoding: string;
  byteOffset: number;
  byteLength: number;
  truncated: boolean;
  data?: unknown;
  parseError?: string;
}

export type FileFormat =
  | "text"
  | "markdown"
  | "json"
  | "yaml"
  | "csv"
  | "xml"
  | "source"
  | "binary"
  | "unknown";

export interface ReadFileOptions {
  /** Byte offset into the file (default 0). */
  offset?: number;
  /** Max bytes to read (default service maxReadBytes). */
  maxBytes?: number;
  /** Attempt structured parse for JSON/YAML/CSV (default true). */
  parse?: boolean;
}

export interface WriteFileOptions {
  /** Create parent directories when missing (default true). */
  createDirs?: boolean;
  /** Write mode (default "overwrite"). */
  mode?: WriteMode;
  /**
   * Prefer `mode`. When `mode` is omitted and this is false, behaves as
   * `mode: "create"`.
   */
  overwrite?: boolean;
  encoding?: WriteEncoding;
  /**
   * Atomic temp→rename for create/overwrite (default true).
   * For append: when true, rewrite via atomic replace (size-capped);
   * when false, platform appendBytes.
   */
  atomic?: boolean;
  /** UTF-8 BOM (default false). UTF-16 always includes BOM. */
  bom?: boolean;
}

export type WriteMode = "create" | "overwrite" | "append";

export type WriteEncoding = "utf-8" | "utf-16le" | "utf-16be";

export interface WriteFileResult {
  path: string;
  bytesWritten: number;
  encoding: WriteEncoding;
  mode: WriteMode;
  atomic: boolean;
  created: boolean;
  /** Present when prior content was moved to Atlas trash before overwrite. */
  backupId?: string;
  backedUp?: boolean;
}

export interface DirEntry {
  path: string;
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
  size?: number;
  mtimeMs?: number;
  /** Present when isSymbolicLink and readlink succeeds. */
  linkTarget?: string;
}

export interface ListDirectoryOptions {
  /** Include names starting with `.` (default false). */
  includeHidden?: boolean;
  /** Apply ignore rules engine (default true). */
  respectIgnore?: boolean;
}

export interface WalkDirectoryOptions {
  maxDepth?: number;
  /** Follow symlinks into directories/files (default false). */
  followSymlinks?: boolean;
  includeHidden?: boolean;
  limit?: number;
  /** Apply ignore rules engine (default true). */
  respectIgnore?: boolean;
}

export interface CreateDirectoryOptions {
  /** Create parents when missing (default true). */
  recursive?: boolean;
}

export interface CreateDirectoryResult {
  path: string;
  /** False when the path already existed as a directory. */
  created: boolean;
}

export interface MovePathOptions {
  /** Create parent of destination (default true). */
  createDirs?: boolean;
  /** Allow replacing an existing file or empty directory (default false). */
  overwrite?: boolean;
}

export interface MovePathResult {
  from: string;
  to: string;
  kind: "file" | "directory";
  backupId?: string;
  backedUp?: boolean;
}

export interface CopyPathOptions {
  createDirs?: boolean;
  overwrite?: boolean;
  /** Recurse into directories (default true). */
  recursive?: boolean;
}

export interface CopyPathResult {
  from: string;
  to: string;
  kind: "file" | "directory";
  bytesCopied?: number;
  overwritten: boolean;
  backupId?: string;
  backedUp?: boolean;
}

export interface DeletePathOptions {
  /** Soft-delete into Atlas trash (default true). */
  trash?: boolean;
  /** When hard-deleting a directory, allow non-empty (default true). */
  recursive?: boolean;
}

export interface DeletePathResult {
  path: string;
  kind: "file" | "directory";
  mode: "trash" | "hard";
  trashId?: string;
  restorable: boolean;
}

export interface RestorePathResult {
  trashId: string;
  path: string;
  kind: "file" | "directory";
}

export interface PathExistsResult {
  exists: boolean;
  isFile: boolean;
  isDirectory: boolean;
}

export interface FileAccessService {
  findFiles(query: FindFilesQuery): FileSearchResult;
  readFile(path: string, opts?: ReadFileOptions): FileContent;
  writeFile(
    path: string,
    content: string,
    opts?: WriteFileOptions,
  ): WriteFileResult;
  createDirectory(
    path: string,
    opts?: CreateDirectoryOptions,
  ): CreateDirectoryResult;
  /** Hard delete (no trash). Prefer `deletePath` for soft-delete. */
  deleteFile(path: string): DeletePathResult;
  /** Empty-directory delete only (ADR-0080). */
  deleteDirectory(path: string): void;
  deletePath(path: string, opts?: DeletePathOptions): DeletePathResult;
  restorePath(trashId: string): RestorePathResult;
  copyPath(from: string, to: string, opts?: CopyPathOptions): CopyPathResult;
  /** Move/rename file or directory via platform rename. */
  movePath(from: string, to: string, opts?: MovePathOptions): MovePathResult;
  /** Alias of `movePath`. */
  renamePath(from: string, to: string, opts?: MovePathOptions): MovePathResult;
  /** @deprecated Prefer `movePath`. */
  moveFile(from: string, to: string, opts?: MovePathOptions): MovePathResult;
  /** True when path exists and is a directory. */
  directoryExists(path: string): boolean;
  /** Existence + type flags (does not throw when missing). */
  pathExists(path: string): PathExistsResult;
  /** Resolve relative/absolute path within configured roots. */
  resolvePath(path: string): string;
  /** List immediate children of a directory (defaults to first root). */
  listDirectory(path?: string, opts?: ListDirectoryOptions): DirEntry[];
  /** Depth-capped directory tree walk (defaults to first root). */
  walkDirectory(path?: string, opts?: WalkDirectoryOptions): DirEntry[];
  /** Unified file / directory metadata (ADR-0077). */
  getFileMetadata(path: string, opts?: GetFileMetadataOptions): FileMetadata;
}

export interface GetFileMetadataOptions {
  /** Follow symlinks with `stat` (default true). Use false for `lstat`. */
  followSymlinks?: boolean;
  /** Compute SHA-256 for regular files under the size cap (default true). */
  includeChecksum?: boolean;
  /** Max bytes to hash (default 16 MiB). */
  maxChecksumBytes?: number;
}

export interface FileMetadataOwner {
  uid: number;
  gid: number;
  /** Present when uid matches the current process user. */
  name?: string;
}

export interface FileMetadataChecksum {
  algorithm: "sha256";
  hex: string;
}

export interface FileMetadata {
  path: string;
  name: string;
  extension: string;
  size: number;
  isFile: boolean;
  isDirectory: boolean;
  isSymbolicLink: boolean;
  createdAtMs: number;
  modifiedAtMs: number;
  mode: number;
  permissions: string;
  owner: FileMetadataOwner;
  mimeType: string;
  checksum?: FileMetadataChecksum;
  checksumSkipped?: string;
}
