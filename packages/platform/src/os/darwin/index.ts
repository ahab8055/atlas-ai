export type {
  DarwinCommandResult,
  DarwinCommandRunOptions,
  DarwinCommandRunner,
} from "./runner.js";
export { createNodeDarwinCommandRunner } from "./runner.js";

export {
  createDarwinApplicationService,
  parseDarwinProcessList,
} from "./applications.js";
export { createDarwinTerminalService } from "./terminal.js";
export { createDarwinClipboardService } from "./clipboard.js";
export { createDarwinNotificationService } from "./notifications.js";

export {
  createDarwinOperatingSystem,
  type CreateDarwinOperatingSystemOptions,
} from "./create.js";
