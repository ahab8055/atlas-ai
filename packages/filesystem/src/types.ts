/**
 * Product File System Access types (Architecture/26 §3).
 * Distinct from platform FileSystemService (os.files CRUD).
 */

export interface FileHit {
  path: string;
  name: string;
  isDirectory?: boolean;
  size?: number;
  match?: "name" | "content";
}

export interface FindFilesQuery {
  /** Name substring or glob-lite (`*` wildcards). */
  pattern: string;
  /** Search root (must be inside configured roots). Defaults to first root. */
  root?: string;
  /** Also scan file contents (size-capped). */
  content?: boolean;
  /** Max hits to return (default 50). */
  limit?: number;
}

export interface FileContent {
  path: string;
  content: string;
  size: number;
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
  findFiles(query: FindFilesQuery): FileHit[];
  readFile(path: string): FileContent;
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
}
