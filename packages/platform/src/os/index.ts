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

export {
  createWindowsOperatingSystem,
  createNodeWindowsCommandRunner,
  createWindowsApplicationService,
  createWindowsTerminalService,
  createWindowsClipboardService,
  createWindowsNotificationService,
  parseProcessList,
} from "./windows/index.js";

export type {
  WindowsCommandResult,
  WindowsCommandRunOptions,
  WindowsCommandRunner,
  CreateWindowsOperatingSystemOptions,
} from "./windows/index.js";

export {
  createDarwinOperatingSystem,
  createNodeDarwinCommandRunner,
  createDarwinApplicationService,
  createDarwinTerminalService,
  createDarwinClipboardService,
  createDarwinNotificationService,
  parseDarwinProcessList,
} from "./darwin/index.js";

export type {
  DarwinCommandResult,
  DarwinCommandRunOptions,
  DarwinCommandRunner,
  CreateDarwinOperatingSystemOptions,
} from "./darwin/index.js";

export {
  createLinuxOperatingSystem,
  createNodeLinuxCommandRunner,
  createLinuxApplicationService,
  createLinuxTerminalService,
  createLinuxClipboardService,
  createLinuxNotificationService,
  parseLinuxProcessList,
} from "./linux/index.js";

export type {
  LinuxCommandResult,
  LinuxCommandRunOptions,
  LinuxCommandRunner,
  CreateLinuxOperatingSystemOptions,
} from "./linux/index.js";
