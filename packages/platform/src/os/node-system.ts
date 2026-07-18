/**
 * Node SystemInformationService backed by PlatformInfo + node:os.
 */
import os from "node:os";

import type { PlatformInfo } from "../types.js";
import type { SystemInformationService } from "./types.js";

export interface CreateNodeSystemInformationOptions {
  info: PlatformInfo;
  hostname?: () => string;
  uptime?: () => number;
}

export function createNodeSystemInformationService(
  options: CreateNodeSystemInformationOptions,
): SystemInformationService {
  return {
    getPlatform(): PlatformInfo {
      return options.info;
    },
    getHostname(): string {
      try {
        return (options.hostname ?? (() => os.hostname()))();
      } catch {
        return "unknown";
      }
    },
    getUptime(): number {
      try {
        return (options.uptime ?? (() => os.uptime()))();
      } catch {
        return 0;
      }
    },
  };
}
