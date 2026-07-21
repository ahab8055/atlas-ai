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
  /** Allow overwriting an existing file (default true). */
  overwrite?: boolean;
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
}

export interface WalkDirectoryOptions {
  maxDepth?: number;
  /** Follow symlinks into directories/files (default false). */
  followSymlinks?: boolean;
  includeHidden?: boolean;
  limit?: number;
}

export interface FileAccessService {
  findFiles(query: FindFilesQuery): FileSearchResult;
  readFile(path: string, opts?: ReadFileOptions): FileContent;
  writeFile(path: string, content: string, opts?: WriteFileOptions): void;
  createDirectory(path: string): void;
  deleteFile(path: string): void;
  moveFile(from: string, to: string): void;
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
