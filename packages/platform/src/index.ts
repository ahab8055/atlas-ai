export type {
  EnvService,
  FsService,
  PathService,
  PlatformId,
  PlatformInfo,
  PlatformServices,
  ResolvedAtlasPaths,
  ResolvePlatformPathsOverrides,
} from "./types.js";

export { DEFAULT_APP_NAME } from "./types.js";

export { detectPlatformId } from "./detect.js";

export {
  PlatformManager,
  createPlatformManager,
  getDefaultPlatformManager,
  __resetDefaultPlatformManagerForTests,
  type PlatformManagerOptions,
} from "./manager.js";

export { resolvePlatformPaths } from "./resolve-paths.js";

export {
  createNodePlatformInfo,
  createNodePlatformServices,
  createDarwinPlatformServices,
  createLinuxPlatformServices,
  createWin32PlatformServices,
} from "./node/index.js";

export { createNodeEnvService, createNodeFsService } from "./node/shared.js";

export { createPathService } from "./node/paths.js";
