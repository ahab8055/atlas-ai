/**
 * Assemble Linux OperatingSystem provider (ADR-0065).
 */
import type { EnvService, PathService, PlatformInfo } from "../../types.js";
import { createNodeFileSystemService } from "../node-files.js";
import { createNodeSystemInformationService } from "../node-system.js";
import type { OperatingSystem } from "../types.js";
import { createLinuxApplicationService } from "./applications.js";
import { createLinuxClipboardService } from "./clipboard.js";
import { createLinuxNotificationService } from "./notifications.js";
import {
  createNodeLinuxCommandRunner,
  type LinuxCommandRunner,
} from "./runner.js";
import { createLinuxTerminalService } from "./terminal.js";

export interface CreateLinuxOperatingSystemOptions {
  info: PlatformInfo;
  paths: PathService;
  env: EnvService;
  runner?: LinuxCommandRunner;
  overrides?: Partial<OperatingSystem>;
}

export function createLinuxOperatingSystem(
  options: CreateLinuxOperatingSystemOptions,
): OperatingSystem {
  const runner = options.runner ?? createNodeLinuxCommandRunner();
  const base: OperatingSystem = {
    applications: createLinuxApplicationService(runner),
    files: createNodeFileSystemService(),
    terminal: createLinuxTerminalService(runner),
    notifications: createLinuxNotificationService(runner),
    clipboard: createLinuxClipboardService({
      runner,
      env: options.env,
    }),
    system: createNodeSystemInformationService({ info: options.info }),
    paths: options.paths,
    env: options.env,
  };

  const o = options.overrides;
  if (!o) {
    return base;
  }

  return {
    applications: o.applications ?? base.applications,
    files: o.files ?? base.files,
    terminal: o.terminal ?? base.terminal,
    notifications: o.notifications ?? base.notifications,
    clipboard: o.clipboard ?? base.clipboard,
    system: o.system ?? base.system,
    paths: o.paths ?? base.paths,
    env: o.env ?? base.env,
  };
}
