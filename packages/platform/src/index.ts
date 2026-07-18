export type {
  EnvService,
  FsService,
  PathService,
  PlatformId,
  PlatformInfo,
  PlatformOs,
  PlatformRuntime,
  PlatformServices,
  ResolvedAtlasPaths,
  ResolvePlatformPathsOverrides,
  RuntimeKind,
} from "./types.js";

export { DEFAULT_APP_NAME, platformIdToOs } from "./types.js";

export { detectPlatformId } from "./detect.js";

export type { OsProbe } from "./probe.js";
export { createNodeOsProbe } from "./probe.js";

export {
  PlatformDetector,
  createPlatformDetector,
  type PlatformDetectorOptions,
} from "./detector.js";

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
