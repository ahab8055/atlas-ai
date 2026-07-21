export type {
  DirEntry,
  FileAccessService,
  FileContent,
  FileHit,
  FindFilesQuery,
  ListDirectoryOptions,
  WalkDirectoryOptions,
  WriteFileOptions,
} from "./types.js";

export {
  createFileAccessService,
  type FileAccessServiceOptions,
} from "./service.js";

export {
  __resetDefaultFileAccessServiceForTests,
  bootstrapFileAccessFromRegistry,
  getDefaultFileAccessService,
  setDefaultFileAccessService,
  type BootstrapFileAccessOptions,
} from "./defaults.js";

export {
  DEFAULT_DENY_PATTERNS,
  isPathInsideRoots,
  isSensitiveBasename,
  matchesDeny,
  normalizePathSeparators,
  patternToRegExp,
  resolveWithinRoots,
} from "./paths.js";

export {
  createMemoryFileSystemService,
  type MemoryFileSystemService,
} from "./memory-fs.js";
