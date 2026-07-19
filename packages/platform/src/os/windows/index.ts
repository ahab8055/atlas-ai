export type {
  WindowsCommandResult,
  WindowsCommandRunOptions,
  WindowsCommandRunner,
} from "./runner.js";
export { createNodeWindowsCommandRunner } from "./runner.js";

export {
  createWindowsApplicationService,
  parseProcessList,
} from "./applications.js";
export { createWindowsTerminalService } from "./terminal.js";
export { createWindowsClipboardService } from "./clipboard.js";
export { createWindowsNotificationService } from "./notifications.js";

export {
  createWindowsOperatingSystem,
  type CreateWindowsOperatingSystemOptions,
} from "./create.js";
