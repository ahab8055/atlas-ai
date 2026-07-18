/**
 * Host OS platform service interfaces (ADR-0060).
 */

export type PlatformId = "darwin" | "linux" | "win32";

export interface PlatformInfo {
  id: PlatformId;
  arch: string;
  runtime: "node";
  versions: { node?: string };
}

export interface PathService {
  homeDir(): string;
  tempDir(): string;
  /** OS user-data directory for Atlas (e.g. Application Support / APPDATA / XDG). */
  userDataDir(appName?: string): string;
  cacheDir(appName?: string): string;
  cwd(): string;
  join(...parts: string[]): string;
}

export interface EnvService {
  get(name: string): string | undefined;
  getOr(name: string, fallback: string): string;
}

export interface FsService {
  exists(path: string): boolean;
  mkdirp(path: string): void;
  readText(path: string): string;
  writeText(path: string, data: string, mode?: number): void;
}

export interface PlatformServices {
  info: PlatformInfo;
  paths: PathService;
  env: EnvService;
  fs: FsService;
}

/** Absolute Atlas path layout under userDataDir (opt-in; does not change CLI relative defaults). */
export interface ResolvedAtlasPaths {
  dataDir: string;
  modelsDir: string;
  databasePath: string;
}

export interface ResolvePlatformPathsOverrides {
  dataDir?: string;
  modelsDir?: string;
  databasePath?: string;
  appName?: string;
}

export const DEFAULT_APP_NAME = "Atlas";
