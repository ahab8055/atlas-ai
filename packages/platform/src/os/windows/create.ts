/**
 * Assemble Windows OperatingSystem provider (ADR-0063).
 */
import type { EnvService, PathService, PlatformInfo } from "../../types.js";
import { createNodeFileSystemService } from "../node-files.js";
import { createNodeSystemInformationService } from "../node-system.js";
import type { OperatingSystem } from "../types.js";
import { createWindowsApplicationService } from "./applications.js";
import { createWindowsClipboardService } from "./clipboard.js";
import { createWindowsNotificationService } from "./notifications.js";
import {
  createNodeWindowsCommandRunner,
  type WindowsCommandRunner,
} from "./runner.js";
import { createWindowsTerminalService } from "./terminal.js";

export interface CreateWindowsOperatingSystemOptions {
  info: PlatformInfo;
  paths: PathService;
  env: EnvService;
  runner?: WindowsCommandRunner;
  overrides?: Partial<OperatingSystem>;
}

export function createWindowsOperatingSystem(
  options: CreateWindowsOperatingSystemOptions,
): OperatingSystem {
  const runner = options.runner ?? createNodeWindowsCommandRunner();
  const base: OperatingSystem = {
    applications: createWindowsApplicationService(runner),
    files: createNodeFileSystemService(),
    terminal: createWindowsTerminalService(runner),
    notifications: createWindowsNotificationService(runner),
    clipboard: createWindowsClipboardService(runner),
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
