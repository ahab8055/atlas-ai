/**
 * Build PlatformServices for a Node PlatformId.
 */
import type {
  EnvService,
  FsService,
  PlatformId,
  PlatformInfo,
  PlatformServices,
} from "../types.js";
import { createPathService, type PathServiceOptions } from "./paths.js";
import { createNodeEnvService, createNodeFsService } from "./shared.js";

export interface CreateNodeServicesOptions {
  env?: EnvService;
  fs?: FsService;
  arch?: string;
  nodeVersion?: string;
  pathOptions?: Omit<PathServiceOptions, "env">;
}

export function createNodePlatformInfo(
  id: PlatformId,
  options: CreateNodeServicesOptions = {},
): PlatformInfo {
  return {
    id,
    arch: options.arch ?? process.arch,
    runtime: "node",
    versions: {
      node: options.nodeVersion ?? process.versions.node,
    },
  };
}

export function createNodePlatformServices(
  id: PlatformId,
  options: CreateNodeServicesOptions = {},
): PlatformServices {
  const env = options.env ?? createNodeEnvService();
  const fs = options.fs ?? createNodeFsService();
  const paths = createPathService(id, {
    env,
    ...options.pathOptions,
  });
  return {
    info: createNodePlatformInfo(id, options),
    paths,
    env,
    fs,
  };
}
