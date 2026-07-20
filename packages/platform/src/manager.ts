/**
 * PlatformManager — loads the correct Node OS adapter at runtime
 * (ADR-0060 / 0061 / 0062 / 0063 / 0064 / 0065 / 0066 / 0067).
 */
import {
  getDefaultPermissionManager,
  type PermissionManager,
} from "@atlas-ai/security";

import { createPlatformDetector } from "./detector.js";
import { detectPlatformId } from "./detect.js";
import { emitPlatformEvent, type PlatformEventPublisher } from "./events.js";
import { createDarwinPlatformServices } from "./node/darwin.js";
import { createLinuxPlatformServices } from "./node/linux.js";
import { createWin32PlatformServices } from "./node/win32.js";
import type { CreateNodeServicesOptions } from "./node/services.js";
import type { DarwinCommandRunner } from "./os/darwin/runner.js";
import type { LinuxCommandRunner } from "./os/linux/runner.js";
import {
  OsPermissionBroker,
  wrapOperatingSystemWithBroker,
} from "./os/permission-broker.js";
import type { OperatingSystem } from "./os/types.js";
import type { WindowsCommandRunner } from "./os/windows/runner.js";
import type { OsProbe } from "./probe.js";
import type { PlatformId, PlatformInfo, PlatformServices } from "./types.js";

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
  /** Force a platform (tests). Default: detect via PlatformDetector. */
  platformId?: PlatformId;
  /** Injectable OS probe for detection. */
  probe?: OsProbe;
  /** Dependency-injection overrides merged over the Node adapter. */
  services?: Partial<PlatformServices>;
  /** Partial OperatingSystem capability overrides (merged onto Node default). */
  os?: Partial<OperatingSystem>;
  /** Injectable Windows command runner (tests / DI). */
  windowsRunner?: WindowsCommandRunner;
  /** Injectable Darwin command runner (tests / DI). */
  darwinRunner?: DarwinCommandRunner;
  /** Injectable Linux command runner (tests / DI). */
  linuxRunner?: LinuxCommandRunner;
  /** Permission manager used by the OS permission broker. */
  permissionManager?: PermissionManager;
  /** Custom OS permission broker (overrides permissionManager). */
  permissionBroker?: OsPermissionBroker;
  /** Optional callback for platform lifecycle / permission / failure events. */
  onPlatformEvent?: PlatformEventPublisher;
  /**
   * When true (default), wrap OS privileged methods with OsPermissionBroker.
   * Set false for raw provider tests.
   */
  enforceOsPermissions?: boolean;
  /** Passed through to Node adapter construction (tests). */
  arch?: string;
  nodeVersion?: string;
  kernelVersion?: string;
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
    const detector = createPlatformDetector({ probe: options.probe });
    let info: PlatformInfo | undefined = options.services?.info;
    let platformId = options.platformId;

    if (!info) {
      const detected = detector.detect();
      platformId = platformId ?? detected.id;
      info =
        platformId === detected.id
          ? detected
          : {
              ...detected,
              id: platformId,
              os:
                platformId === "darwin"
                  ? "macos"
                  : platformId === "win32"
                    ? "windows"
                    : "linux",
            };
      if (options.arch !== undefined) {
        info = { ...info, arch: options.arch };
      }
      if (options.nodeVersion !== undefined) {
        info = {
          ...info,
          runtime: { kind: "node", version: options.nodeVersion },
        };
      }
      if (options.kernelVersion !== undefined) {
        info = { ...info, kernelVersion: options.kernelVersion };
      }
    } else {
      platformId = platformId ?? info.id;
    }

    platformId = platformId ?? detectPlatformId();

    const base = loadNodeAdapter(platformId, {
      env: options.env,
      fs: options.fs,
      info,
      probe: options.probe,
      osOverrides: options.os,
      windowsRunner: options.windowsRunner,
      darwinRunner: options.darwinRunner,
      linuxRunner: options.linuxRunner,
      arch: options.arch,
      nodeVersion: options.nodeVersion,
      kernelVersion: options.kernelVersion,
      pathOptions: {
        homeDir: options.homeDir,
        tempDir: options.tempDir,
        cwd: options.cwd,
      },
    });

    let os = base.os;
    if (options.enforceOsPermissions !== false) {
      const broker =
        options.permissionBroker ??
        new OsPermissionBroker({
          permissions:
            options.permissionManager ?? getDefaultPermissionManager(),
          onPlatformEvent: options.onPlatformEvent,
        });
      os = wrapOperatingSystemWithBroker(os, broker);
    }

    const services: PlatformServices = {
      info: options.services?.info ?? base.info,
      paths: options.services?.paths ?? base.paths,
      env: options.services?.env ?? base.env,
      fs: options.services?.fs ?? base.fs,
      // Prefer adapter-built OS (optionally broker-wrapped); allow full replace via services.os
      os: options.services?.os ?? os,
    };
    const manager = new PlatformManager(platformId, services);
    emitPlatformEvent(options.onPlatformEvent, "PlatformDetected", {
      platformId,
      os: services.info.os,
      arch: services.info.arch,
    });
    return manager;
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

/** Replace the lazy singleton (hosts / tests / bootstrap). */
export function setDefaultPlatformManager(manager: PlatformManager): void {
  defaultManager = manager;
}

/** Test helper — clears the lazy singleton. */
export function __resetDefaultPlatformManagerForTests(): void {
  defaultManager = undefined;
}
