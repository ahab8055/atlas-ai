/**
 * Build PlatformServices for a Node PlatformId.
 */
import { createPlatformDetector } from "../detector.js";
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
  return {
    info: createNodePlatformInfo(id, options),
    paths,
    env,
    fs,
  };
}
