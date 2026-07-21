export type {
  DirEntry,
  FileAccessService,
  FileContent,
  FileHit,
  FileMetadata,
  FileMetadataChecksum,
  FileMetadataOwner,
  FileSearchResult,
  FindFilesQuery,
  GetFileMetadataOptions,
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
  fileExtension,
  isPathInsideRoots,
  isSensitiveBasename,
  matchesDeny,
  normalizeExtensions,
  normalizePathSeparators,
  patternToRegExp,
  resolveWithinRoots,
} from "./paths.js";

export { mimeForEntry, mimeFromExtension } from "./mime.js";
export { modeToPermissions } from "./permissions-format.js";

export {
  createMemoryFileSystemService,
  type MemoryFileSystemService,
} from "./memory-fs.js";
