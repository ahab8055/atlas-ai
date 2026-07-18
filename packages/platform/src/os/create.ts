/**
 * Assemble Node OperatingSystem facade (ADR-0062).
 */
import type { EnvService, PathService, PlatformInfo } from "../types.js";
import { createNodeFileSystemService } from "./node-files.js";
import {
  createStubApplicationService,
  createStubClipboardService,
  createStubNotificationService,
  createStubTerminalService,
} from "./node-stubs.js";
import { createNodeSystemInformationService } from "./node-system.js";
import type { OperatingSystem } from "./types.js";

export interface CreateNodeOperatingSystemOptions {
  info: PlatformInfo;
  paths: PathService;
  env: EnvService;
  /** Partial capability overrides (DI). */
  overrides?: Partial<OperatingSystem>;
}

export function createNodeOperatingSystem(
  options: CreateNodeOperatingSystemOptions,
): OperatingSystem {
  const base: OperatingSystem = {
    applications: createStubApplicationService(),
    files: createNodeFileSystemService(),
    terminal: createStubTerminalService(),
    notifications: createStubNotificationService(),
    clipboard: createStubClipboardService(),
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
