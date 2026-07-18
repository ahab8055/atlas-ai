export type {
  ApplicationService,
  ClipboardService,
  FileStat,
  FileSystemService,
  NotificationInput,
  NotificationService,
  NotificationUrgency,
  OperatingSystem,
  RunningApplication,
  SystemInformationService,
  TerminalExecuteOptions,
  TerminalExecuteResult,
  TerminalService,
} from "./types.js";

export type { PlatformErrorCode } from "./errors.js";
export { PlatformError, isPlatformError } from "./errors.js";

export { createNodeOperatingSystem } from "./create.js";
export { createNodeFileSystemService } from "./node-files.js";
export { createNodeSystemInformationService } from "./node-system.js";
export {
  createStubApplicationService,
  createStubClipboardService,
  createStubNotificationService,
  createStubTerminalService,
} from "./node-stubs.js";
