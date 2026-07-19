/**
 * Assemble Darwin / macOS OperatingSystem provider (ADR-0064).
 */
import type { EnvService, PathService, PlatformInfo } from "../../types.js";
import { createNodeFileSystemService } from "../node-files.js";
import { createNodeSystemInformationService } from "../node-system.js";
import type { OperatingSystem } from "../types.js";
import { createDarwinApplicationService } from "./applications.js";
import { createDarwinClipboardService } from "./clipboard.js";
import { createDarwinNotificationService } from "./notifications.js";
import {
  createNodeDarwinCommandRunner,
  type DarwinCommandRunner,
} from "./runner.js";
import { createDarwinTerminalService } from "./terminal.js";

export interface CreateDarwinOperatingSystemOptions {
  info: PlatformInfo;
  paths: PathService;
  env: EnvService;
  runner?: DarwinCommandRunner;
  overrides?: Partial<OperatingSystem>;
}

export function createDarwinOperatingSystem(
  options: CreateDarwinOperatingSystemOptions,
): OperatingSystem {
  const runner = options.runner ?? createNodeDarwinCommandRunner();
  const base: OperatingSystem = {
    applications: createDarwinApplicationService(runner),
    files: createNodeFileSystemService(),
    terminal: createDarwinTerminalService(runner),
    notifications: createDarwinNotificationService(runner),
    clipboard: createDarwinClipboardService(runner),
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
