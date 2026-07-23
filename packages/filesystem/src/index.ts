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
  CopyPathOptions,
  CopyPathResult,
  DeletePathOptions,
  DeletePathResult,
  MovePathOptions,
  MovePathResult,
  PathExistsResult,
  ReadFileOptions,
  RestorePathResult,
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
  __resetDefaultFileWatcherServiceForTests,
  bootstrapFileAccessFromRegistry,
  bootstrapFileWatcherFromRegistry,
  getDefaultFileAccessService,
  getDefaultFileWatcherService,
  setDefaultFileAccessService,
  setDefaultFileWatcherService,
  type BootstrapFileAccessOptions,
  type BootstrapFileWatcherOptions,
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

export { isDestructiveFsOperation } from "./safe-ops.js";
export {
  clearFsConfirmHost,
  configureFsConfirmHost,
  withFsConfirmRetry,
  type FsConfirmHandler,
  type FsConfirmRequest,
} from "./confirm-host.js";

export {
  FILE_SYSTEM_EVENTS,
  emitFileSystemEvent,
  isFileSystemEventType,
  type FileSystemEventBase,
  type FileSystemEventPayloadMap,
  type FileSystemEventPublisher,
  type FileSystemEventType,
} from "./events.js";

export {
  createFileWatcherService,
  type FileWatcherService,
  type FileWatcherServiceOptions,
  type WatchDirectoryOptions,
  type WatchHandle,
} from "./watcher.js";

export {
  BUILTIN_IGNORE_PATTERNS,
  compileGitignorePattern,
  createIgnoreRulesEngine,
  parseIgnoreFileContent,
  type IgnoreRulesEngine,
  type IgnoreRulesEngineOptions,
  type ShouldIgnoreOptions,
} from "./ignore.js";

export {
  __resetRecentFilesStoreForTests,
  getRecentFilesStore,
  listRecentFiles,
  setRecentFilesStore,
  type RecentFileAccessAction,
  type RecentFileEntry,
  type RecentFilesListOptions,
  type RecentFilesSort,
  type RecentFilesStore,
} from "./recent.js";
