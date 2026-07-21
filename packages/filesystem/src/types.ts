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

export interface FileAccessService {
  findFiles(query: FindFilesQuery): FileHit[];
  readFile(path: string): FileContent;
  writeFile(path: string, content: string, opts?: WriteFileOptions): void;
  createDirectory(path: string): void;
  deleteFile(path: string): void;
  moveFile(from: string, to: string): void;
}
