/**
 * PlatformManager — loads the correct Node OS adapter at runtime (ADR-0060).
 */
import { detectPlatformId } from "./detect.js";
import { createDarwinPlatformServices } from "./node/darwin.js";
import { createLinuxPlatformServices } from "./node/linux.js";
import { createWin32PlatformServices } from "./node/win32.js";
import type { PlatformId, PlatformServices } from "./types.js";
import type { CreateNodeServicesOptions } from "./node/services.js";

function loadNodeAdapter(
  platformId: PlatformId,
  options: CreateNodeServicesOptions,
): PlatformServices {
  switch (platformId) {
    case "darwin":
      return createDarwinPlatformServices(options);
    case "linux":
      return createLinuxPlatformServices(options);
    case "win32":
      return createWin32PlatformServices(options);
  }
}

export interface PlatformManagerOptions {
  /** Force a platform (tests). Default: detect from process.platform. */
  platformId?: PlatformId;
  /** Dependency-injection overrides merged over the Node adapter. */
  services?: Partial<PlatformServices>;
  /** Passed through to Node adapter construction (tests). */
  arch?: string;
  nodeVersion?: string;
  homeDir?: string;
  tempDir?: string;
  cwd?: string;
  env?: PlatformServices["env"];
  fs?: PlatformServices["fs"];
}

export class PlatformManager {
  readonly platformId: PlatformId;
  private readonly services: PlatformServices;

  private constructor(platformId: PlatformId, services: PlatformServices) {
    this.platformId = platformId;
    this.services = services;
  }

  static create(options: PlatformManagerOptions = {}): PlatformManager {
    const platformId = options.platformId ?? detectPlatformId();
    const base = loadNodeAdapter(platformId, {
      env: options.env,
      fs: options.fs,
      arch: options.arch,
      nodeVersion: options.nodeVersion,
      pathOptions: {
        homeDir: options.homeDir,
        tempDir: options.tempDir,
        cwd: options.cwd,
      },
    });
    const services: PlatformServices = {
      info: options.services?.info ?? base.info,
      paths: options.services?.paths ?? base.paths,
      env: options.services?.env ?? base.env,
      fs: options.services?.fs ?? base.fs,
    };
    return new PlatformManager(platformId, services);
  }

  getServices(): PlatformServices {
    return this.services;
  }
}

export function createPlatformManager(
  options?: PlatformManagerOptions,
): PlatformManager {
  return PlatformManager.create(options);
}

let defaultManager: PlatformManager | undefined;

/** Lazy singleton for CLI/desktop wiring when no explicit manager is injected. */
export function getDefaultPlatformManager(): PlatformManager {
  if (!defaultManager) {
    defaultManager = PlatformManager.create();
  }
  return defaultManager;
}

/** Test helper — clears the lazy singleton. */
export function __resetDefaultPlatformManagerForTests(): void {
  defaultManager = undefined;
}
