/**
 * Default FileAccessService + FileWatcherService singletons + registry bootstrap.
 */
import type { Logger } from "@atlas-ai/logging";
import type { PlatformServiceRegistry } from "@atlas-ai/platform";
import type { PermissionManager } from "@atlas-ai/security";

import type { FileSystemEventPublisher } from "./events.js";
import {
  createFileAccessService,
  type FileAccessServiceOptions,
} from "./service.js";
import type { FileAccessService } from "./types.js";
import {
  createFileWatcherService,
  type FileWatcherService,
  type FileWatcherServiceOptions,
} from "./watcher.js";

let defaultService: FileAccessService | undefined;
let defaultWatcher: FileWatcherService | undefined;

export function getDefaultFileAccessService(): FileAccessService {
  if (!defaultService) {
    throw new Error(
      "FileAccessService is not bootstrapped; call bootstrapFileAccessFromRegistry or setDefaultFileAccessService",
    );
  }
  return defaultService;
}

export function setDefaultFileAccessService(service: FileAccessService): void {
  defaultService = service;
}

export function __resetDefaultFileAccessServiceForTests(): void {
  defaultService = undefined;
}

export function getDefaultFileWatcherService(): FileWatcherService {
  if (!defaultWatcher) {
    throw new Error(
      "FileWatcherService is not bootstrapped; call bootstrapFileWatcherFromRegistry or setDefaultFileWatcherService",
    );
  }
  return defaultWatcher;
}

export function setDefaultFileWatcherService(
  service: FileWatcherService,
): void {
  defaultWatcher = service;
}

export function __resetDefaultFileWatcherServiceForTests(): void {
  defaultWatcher?.stopAll();
  defaultWatcher = undefined;
}

export type BootstrapFileAccessOptions = Omit<
  FileAccessServiceOptions,
  "files" | "paths"
> & {
  permissions?: PermissionManager;
  logger?: Logger;
};

/**
 * Resolve os.files / os.paths from the platform registry and set the default.
 */
export function bootstrapFileAccessFromRegistry(
  registry: PlatformServiceRegistry,
  options: BootstrapFileAccessOptions = {},
): FileAccessService {
  const files = registry.resolve("os.files");
  const paths = registry.resolve("os.paths");
  const service = createFileAccessService({
    files,
    paths,
    roots: options.roots ?? [paths.cwd()],
    maxDepth: options.maxDepth,
    maxReadBytes: options.maxReadBytes,
    denyPatterns: options.denyPatterns,
    defaultLimit: options.defaultLimit,
    permissions: options.permissions,
    logger: options.logger,
    onAccess: options.onAccess,
    onPathGone: options.onPathGone,
    ignorePatterns: options.ignorePatterns,
    respectGitignore: options.respectGitignore,
    respectAtlasignore: options.respectAtlasignore,
    useBuiltinIgnoreDefaults: options.useBuiltinIgnoreDefaults,
    ignore: options.ignore,
  });
  setDefaultFileAccessService(service);
  return service;
}

export type BootstrapFileWatcherOptions = Omit<
  FileWatcherServiceOptions,
  "files" | "paths"
> & {
  permissions?: PermissionManager;
  logger?: Logger;
  onFileEvent?: FileSystemEventPublisher;
};

/**
 * Resolve os.files / os.paths and set the default FileWatcherService.
 * Does not start watching — call watchDirectory explicitly.
 */
export function bootstrapFileWatcherFromRegistry(
  registry: PlatformServiceRegistry,
  options: BootstrapFileWatcherOptions = {},
): FileWatcherService {
  const files = registry.resolve("os.files");
  const paths = registry.resolve("os.paths");
  const service = createFileWatcherService({
    files,
    paths,
    roots: options.roots ?? [paths.cwd()],
    denyPatterns: options.denyPatterns,
    permissions: options.permissions,
    logger: options.logger,
    onFileEvent: options.onFileEvent,
    ignorePatterns: options.ignorePatterns,
    respectGitignore: options.respectGitignore,
    respectAtlasignore: options.respectAtlasignore,
    useBuiltinIgnoreDefaults: options.useBuiltinIgnoreDefaults,
    ignore: options.ignore,
  });
  setDefaultFileWatcherService(service);
  return service;
}
