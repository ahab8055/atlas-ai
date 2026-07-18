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
}

export interface FileSystemService {
  exists(path: string): boolean;
  readText(path: string): string;
  writeText(path: string, data: string, mode?: number): void;
  mkdirp(path: string): void;
  remove(path: string): void;
  listDir(path: string): string[];
  stat(path: string): FileStat;
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
