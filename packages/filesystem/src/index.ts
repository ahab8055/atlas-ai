export type {
  DirEntry,
  FileAccessService,
  FileContent,
  FileFormat,
  FileHit,
  FileMetadata,
  FileMetadataChecksum,
  FileMetadataOwner,
  FileSearchResult,
  FindFilesQuery,
  GetFileMetadataOptions,
  ListDirectoryOptions,
  CreateDirectoryOptions,
  CreateDirectoryResult,
  MovePathOptions,
  MovePathResult,
  PathExistsResult,
  ReadFileOptions,
  WalkDirectoryOptions,
  WriteEncoding,
  WriteFileOptions,
  WriteFileResult,
  WriteMode,
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
export { decodeBytes, encodeBytes } from "./encoding.js";
export {
  formatFromExtension,
  isBinaryMime,
  isUnsupportedBinaryFormat,
} from "./format.js";

export {
  createMemoryFileSystemService,
  type MemoryFileSystemService,
} from "./memory-fs.js";
