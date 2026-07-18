/**
 * Host OS platform service interfaces (ADR-0060 / ADR-0061).
 */

export type PlatformId = "darwin" | "linux" | "win32";

/** Friendly OS family (darwin → macos, win32 → windows). */
export type PlatformOs = "macos" | "windows" | "linux";

/** Runtime kind; Node today, Tauri later. */
export type RuntimeKind = "node";

export interface PlatformRuntime {
  kind: RuntimeKind;
  version: string;
}

export interface PlatformInfo {
  id: PlatformId;
  os: PlatformOs;
  arch: string;
  /** Kernel / OS release string from os.release(). */
  kernelVersion: string;
  /** os.type() — e.g. Darwin, Linux, Windows_NT. */
  osType: string;
  /** os.version() when available. */
  osVersion?: string;
  runtime: PlatformRuntime;
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
  /** Common OS facade — preferred API for new modules (ADR-0062). */
  os: import("./os/types.js").OperatingSystem;
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

/** Map PlatformId to friendly PlatformOs. */
export function platformIdToOs(id: PlatformId): PlatformOs {
  switch (id) {
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    case "linux":
      return "linux";
  }
}
