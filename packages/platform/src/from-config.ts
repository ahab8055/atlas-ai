/**
 * Map serializable platform config → PlatformManagerOptions (ADR-0070).
 * Duck-typed input — `@atlas-ai/platform` does not depend on `@atlas-ai/config`.
 */
import type { PlatformManagerOptions } from "./manager.js";
import type { PlatformId } from "./types.js";

export interface PlatformConfigLike {
  forcePlatformId?: PlatformId;
  features: {
    osPermissionBroker: boolean;
    platformEvents: boolean;
  };
}

export type PlatformManagerExtras = Pick<
  PlatformManagerOptions,
  | "permissionManager"
  | "permissionBroker"
  | "onPlatformEvent"
  | "logger"
  | "probe"
  | "services"
  | "os"
  | "windowsRunner"
  | "darwinRunner"
  | "linuxRunner"
  | "arch"
  | "nodeVersion"
  | "kernelVersion"
  | "homeDir"
  | "tempDir"
  | "cwd"
  | "env"
  | "fs"
>;

/**
 * Convert Atlas platform config into PlatformManager / bootstrap options.
 * Hosts should omit `onPlatformEvent` in extras when `features.platformEvents`
 * is false (or pass undefined).
 */
export function toPlatformManagerOptions(
  platform: PlatformConfigLike,
  extras: PlatformManagerExtras = {},
): PlatformManagerOptions {
  return {
    ...extras,
    ...(platform.forcePlatformId !== undefined
      ? { platformId: platform.forcePlatformId }
      : {}),
    enforceOsPermissions: platform.features.osPermissionBroker,
  };
}
