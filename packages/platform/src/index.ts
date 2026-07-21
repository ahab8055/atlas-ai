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

export {
  PLATFORM_EVENTS,
  emitPlatformEvent,
  isPlatformEventType,
  type PlatformEventPayloadMap,
  type PlatformEventPublisher,
  type PlatformEventType,
} from "./events.js";

export {
  platformLog,
  platformLogError,
  platformSecurityLog,
  type PlatformLogger,
} from "./diagnostics.js";

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
  setDefaultPlatformManager,
  __resetDefaultPlatformManagerForTests,
  type PlatformManagerOptions,
} from "./manager.js";

export {
  toPlatformManagerOptions,
  type PlatformConfigLike,
  type PlatformManagerExtras,
} from "./from-config.js";

export {
  PlatformServiceRegistry,
  getDefaultPlatformServiceRegistry,
  setDefaultPlatformServiceRegistry,
  bootstrapPlatformServices,
  __resetDefaultPlatformServiceRegistryForTests,
  type PlatformServiceKey,
  type PlatformServiceResolved,
  type RegisterPlatformServicesOptions,
} from "./registry.js";

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

export type {
  ApplicationService,
  ClipboardService,
  FileStat,
  FileSystemService,
  ReadBytesOptions,
  NotificationInput,
  NotificationService,
  NotificationUrgency,
  OperatingSystem,
  RunningApplication,
  SystemInformationService,
  TerminalExecuteOptions,
  TerminalExecuteResult,
  TerminalService,
} from "./os/types.js";

export type {
  PlatformErrorCode,
  PlatformErrorCategory,
  PlatformErrorDetail,
} from "./os/errors.js";
export {
  PlatformError,
  isPlatformError,
  categoryForPlatformCode,
} from "./os/errors.js";
export {
  translateNativeError,
  type TranslateNativeErrorContext,
} from "./os/translate-error.js";

export {
  OsPermissionBroker,
  wrapOperatingSystemWithBroker,
  type OsAuthorizeInput,
  type OsPermissionBrokerOptions,
} from "./os/permission-broker.js";

export {
  createNodeOperatingSystem,
  createNodeFileSystemService,
  createNodeSystemInformationService,
  createStubApplicationService,
  createStubClipboardService,
  createStubNotificationService,
  createStubTerminalService,
} from "./os/index.js";

export type {
  WindowsCommandResult,
  WindowsCommandRunOptions,
  WindowsCommandRunner,
  CreateWindowsOperatingSystemOptions,
} from "./os/windows/index.js";

export {
  createWindowsOperatingSystem,
  createNodeWindowsCommandRunner,
  createWindowsApplicationService,
  createWindowsTerminalService,
  createWindowsClipboardService,
  createWindowsNotificationService,
  parseProcessList,
} from "./os/windows/index.js";

export type {
  DarwinCommandResult,
  DarwinCommandRunOptions,
  DarwinCommandRunner,
  CreateDarwinOperatingSystemOptions,
} from "./os/darwin/index.js";

export {
  createDarwinOperatingSystem,
  createNodeDarwinCommandRunner,
  createDarwinApplicationService,
  createDarwinTerminalService,
  createDarwinClipboardService,
  createDarwinNotificationService,
  parseDarwinProcessList,
} from "./os/darwin/index.js";

export type {
  LinuxCommandResult,
  LinuxCommandRunOptions,
  LinuxCommandRunner,
  CreateLinuxOperatingSystemOptions,
} from "./os/linux/index.js";

export {
  createLinuxOperatingSystem,
  createNodeLinuxCommandRunner,
  createLinuxApplicationService,
  createLinuxTerminalService,
  createLinuxClipboardService,
  createLinuxNotificationService,
  parseLinuxProcessList,
} from "./os/linux/index.js";
