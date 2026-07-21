/**
 * Default FileAccessService singleton + registry bootstrap.
 */
import type { PlatformServiceRegistry } from "@atlas-ai/platform";

import {
  createFileAccessService,
  type FileAccessServiceOptions,
} from "./service.js";
import type { FileAccessService } from "./types.js";

let defaultService: FileAccessService | undefined;

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

export type BootstrapFileAccessOptions = Omit<
  FileAccessServiceOptions,
  "files" | "paths"
>;

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
  });
  setDefaultFileAccessService(service);
  return service;
}
