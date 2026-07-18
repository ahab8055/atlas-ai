/**
 * Node stubs for computer-control capabilities (Phase 4 implements for real).
 */
import { PlatformError } from "./errors.js";
import type {
  ApplicationService,
  ClipboardService,
  NotificationService,
  RunningApplication,
  TerminalExecuteOptions,
  TerminalExecuteResult,
  TerminalService,
} from "./types.js";

function notImplemented(capability: string): never {
  throw new PlatformError(
    "not_implemented",
    `${capability} is not implemented on this Node adapter yet (Phase 4)`,
  );
}

export function createStubApplicationService(): ApplicationService {
  return {
    async open(_appIdOrPath: string): Promise<void> {
      notImplemented("ApplicationService.open");
    },
    async listRunning(): Promise<RunningApplication[]> {
      notImplemented("ApplicationService.listRunning");
    },
    async focus(_pidOrId: string | number): Promise<void> {
      notImplemented("ApplicationService.focus");
    },
    async quit(_pidOrId: string | number): Promise<void> {
      notImplemented("ApplicationService.quit");
    },
  };
}

export function createStubTerminalService(): TerminalService {
  return {
    async execute(
      _command: string,
      _args?: string[],
      _options?: TerminalExecuteOptions,
    ): Promise<TerminalExecuteResult> {
      notImplemented("TerminalService.execute");
    },
  };
}

export function createStubNotificationService(): NotificationService {
  return {
    async show(_input: { title: string; body: string }): Promise<void> {
      notImplemented("NotificationService.show");
    },
  };
}

export function createStubClipboardService(): ClipboardService {
  return {
    async readText(): Promise<string> {
      notImplemented("ClipboardService.readText");
    },
    async writeText(_text: string): Promise<void> {
      notImplemented("ClipboardService.writeText");
    },
  };
}
