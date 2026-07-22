/**
 * Common operating-system capability interfaces (ADR-0062).
 */
import type { EnvService, PathService, PlatformInfo } from "../types.js";

export interface RunningApplication {
  id: string;
  name: string;
  pid?: number;
  path?: string;
}

export interface ApplicationService {
  open(appIdOrPath: string): Promise<void>;
  listRunning(): Promise<RunningApplication[]>;
  focus(pidOrId: string | number): Promise<void>;
  quit(pidOrId: string | number): Promise<void>;
}

export interface FileStat {
  path: string;
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  mtimeMs: number;
  /** Creation time when available (may equal mtime on some filesystems). */
  birthtimeMs: number;
  /** Raw POSIX mode bits from the OS. */
  mode: number;
  uid: number;
  gid: number;
  /** True when the path itself is a symbolic link (lstat); always false for `stat`. */
  isSymbolicLink: boolean;
}

export interface ReadBytesOptions {
  /** Byte offset into the file (default 0). */
  offset?: number;
  /** Max bytes to read; omit to read to EOF from offset. */
  length?: number;
}

export interface FileSystemService {
  exists(path: string): boolean;
  readText(path: string): string;
  /**
   * Raw file bytes (checksums / binary / windowed reads).
   * Without opts, reads the whole file; with offset/length, reads a window.
   */
  readBytes(path: string, opts?: ReadBytesOptions): Uint8Array;
  writeText(path: string, data: string, mode?: number): void;
  /** Write raw bytes (create/overwrite). */
  writeBytes(path: string, data: Uint8Array, opts?: { mode?: number }): void;
  /** Append raw bytes to an existing file (creates if missing). */
  appendBytes(path: string, data: Uint8Array): void;
  /** Rename/move a path (same-volume atomic replace on POSIX). */
  rename(from: string, to: string): void;
  /**
   * Copy a file (not directories). Fails if destination already exists
   * (caller removes first when overwriting).
   */
  copyFile(from: string, to: string): void;
  mkdirp(path: string): void;
  remove(path: string): void;
  listDir(path: string): string[];
  /** Follows symlinks (isSymbolicLink is always false). */
  stat(path: string): FileStat;
  /** Does not follow symlinks. */
  lstat(path: string): FileStat;
  /** Read symlink target (throws if path is not a symlink). */
  readlink(path: string): string;
}

export interface TerminalExecuteOptions {
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
}

export interface TerminalExecuteResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export interface TerminalService {
  execute(
    command: string,
    args?: string[],
    options?: TerminalExecuteOptions,
  ): Promise<TerminalExecuteResult>;
}

export type NotificationUrgency = "low" | "normal" | "critical";

export interface NotificationInput {
  title: string;
  body: string;
  urgency?: NotificationUrgency;
}

export interface NotificationService {
  show(input: NotificationInput): Promise<void>;
}

export interface ClipboardService {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
}

export interface SystemInformationService {
  getPlatform(): PlatformInfo;
  getHostname(): string;
  getUptime(): number;
}

/**
 * Single OS facade — future modules depend on these interfaces only.
 */
export interface OperatingSystem {
  readonly applications: ApplicationService;
  readonly files: FileSystemService;
  readonly terminal: TerminalService;
  readonly notifications: NotificationService;
  readonly clipboard: ClipboardService;
  readonly system: SystemInformationService;
  readonly paths: PathService;
  readonly env: EnvService;
}
