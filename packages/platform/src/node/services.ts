/**
 * Build PlatformServices for a Node PlatformId.
 */
import { createPlatformDetector } from "../detector.js";
import { createNodeOperatingSystem } from "../os/create.js";
import { createDarwinOperatingSystem } from "../os/darwin/create.js";
import type { DarwinCommandRunner } from "../os/darwin/runner.js";
import { createWindowsOperatingSystem } from "../os/windows/create.js";
import type { WindowsCommandRunner } from "../os/windows/runner.js";
import type { OperatingSystem } from "../os/types.js";
import type { OsProbe } from "../probe.js";
import type {
  EnvService,
  FsService,
  PlatformId,
  PlatformInfo,
  PlatformServices,
} from "../types.js";
import { createPathService, type PathServiceOptions } from "./paths.js";
import { createNodeEnvService, createNodeFsService } from "./shared.js";

export interface CreateNodeServicesOptions {
  env?: EnvService;
  fs?: FsService;
  /** Precomputed or overridden platform info (skips detector when set). */
  info?: PlatformInfo;
  /** Injectable probe when building info via PlatformDetector. */
  probe?: OsProbe;
  /** Partial OperatingSystem capability overrides. */
  osOverrides?: Partial<OperatingSystem>;
  /** Injectable Windows command runner (tests). */
  windowsRunner?: WindowsCommandRunner;
  /** Injectable Darwin command runner (tests). */
  darwinRunner?: DarwinCommandRunner;
  /**
   * When true (default for win32 adapter), use Windows OperatingSystem provider.
   * Forced false for generic createNodePlatformServices on non-win32.
   */
  useWindowsOs?: boolean;
  /**
   * When true (default for darwin adapter), use Darwin OperatingSystem provider.
   */
  useDarwinOs?: boolean;
  /** Force platform id when detecting (tests). */
  platformId?: PlatformId;
  arch?: string;
  nodeVersion?: string;
  kernelVersion?: string;
  osType?: string;
  osVersion?: string;
  pathOptions?: Omit<PathServiceOptions, "env">;
}

/**
 * Build PlatformInfo via PlatformDetector, with optional field overrides for tests.
 */
export function createNodePlatformInfo(
  id: PlatformId,
  options: CreateNodeServicesOptions = {},
): PlatformInfo {
  if (options.info) {
    return options.info;
  }

  const detected = createPlatformDetector({
    probe: options.probe,
  }).detect();

  // When caller forces a different id than the host probe, rebuild id/os fields.
  const base: PlatformInfo =
    detected.id === id
      ? detected
      : {
          ...detected,
          id,
          os: id === "darwin" ? "macos" : id === "win32" ? "windows" : "linux",
        };

  return {
    ...base,
    ...(options.arch !== undefined ? { arch: options.arch } : {}),
    ...(options.kernelVersion !== undefined
      ? { kernelVersion: options.kernelVersion }
      : {}),
    ...(options.osType !== undefined ? { osType: options.osType } : {}),
    ...(options.osVersion !== undefined
      ? { osVersion: options.osVersion }
      : {}),
    ...(options.nodeVersion !== undefined
      ? {
          runtime: { kind: "node" as const, version: options.nodeVersion },
        }
      : {}),
  };
}

export function createNodePlatformServices(
  id: PlatformId,
  options: CreateNodeServicesOptions = {},
): PlatformServices {
  const env = options.env ?? createNodeEnvService();
  const fs = options.fs ?? createNodeFsService();
  const paths = createPathService(id, {
    env,
    ...options.pathOptions,
  });
  const info = createNodePlatformInfo(id, options);
  const useWindows =
    options.useWindowsOs === true ||
    (options.useWindowsOs !== false && id === "win32");
  const useDarwin =
    options.useDarwinOs === true ||
    (options.useDarwinOs !== false && id === "darwin");

  let os: OperatingSystem;
  if (useWindows) {
    os = createWindowsOperatingSystem({
      info,
      paths,
      env,
      runner: options.windowsRunner,
      overrides: options.osOverrides,
    });
  } else if (useDarwin) {
    os = createDarwinOperatingSystem({
      info,
      paths,
      env,
      runner: options.darwinRunner,
      overrides: options.osOverrides,
    });
  } else {
    os = createNodeOperatingSystem({
      info,
      paths,
      env,
      overrides: options.osOverrides,
    });
  }

  return {
    info,
    paths,
    env,
    fs,
    os,
  };
}
