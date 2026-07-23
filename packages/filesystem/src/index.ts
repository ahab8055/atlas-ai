export type {
  DirEntry,
  FileAccessService,
  FileContent,
  FileFormat,
  DetectionSource,
  DetectionConfidence,
  DetectedFileTypeResult,
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
  ReadFileChunksOptions,
  FileChunk,
  ForEachFileChunkResult,
  RestorePathResult,
  WalkDirectoryOptions,
  WriteEncoding,
  WriteFileOptions,
  WriteFileResult,
  WriteMode,
} from "./types.js";

export {
  createFileAccessService,
  DEFAULT_MAX_READ_BYTES,
  DEFAULT_MAX_CHUNK_BYTES,
  DEFAULT_MAX_ATOMIC_APPEND_BYTES,
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
  DEFAULT_DETECT_BYTES,
  detectFileType,
  sniffSignature,
  type DetectedFileType,
  type DetectFileTypeOptions,
  type SignatureMatch,
} from "./detect.js";
export {
  indexProcessorForFormat,
  isIndexableFormat,
  processorForFormat,
  type FileProcessorId,
} from "./processors.js";

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
