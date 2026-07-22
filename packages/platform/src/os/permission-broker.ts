/**
 * OsPermissionBroker — authorize privileged OS ops via PermissionManager (ADR-0066).
 */
import {
  getDefaultPermissionManager,
  type PermissionCapability,
  type PermissionManager,
} from "@atlas-ai/security";
import type { Logger } from "@atlas-ai/logging";

import { platformLogError, platformSecurityLog } from "../diagnostics.js";
import { emitPlatformEvent, type PlatformEventPublisher } from "../events.js";
import { PlatformError, isPlatformError } from "./errors.js";
import type {
  ApplicationService,
  ClipboardService,
  FileSystemService,
  NotificationService,
  OperatingSystem,
  SystemInformationService,
  TerminalService,
} from "./types.js";

export interface OsAuthorizeInput {
  /** Stable operation id, e.g. "applications.open". */
  operation: string;
  capability: PermissionCapability;
  reason: string;
  resource?: string;
}

export interface OsPermissionBrokerOptions {
  permissions?: PermissionManager;
  onPlatformEvent?: PlatformEventPublisher;
  logger?: Logger;
}

/**
 * Central gate for privileged OperatingSystem calls.
 * Logs every check via PermissionManager; throws when blocked.
 */
export class OsPermissionBroker {
  private readonly permissions: PermissionManager;
  private readonly publisher?: PlatformEventPublisher;
  private readonly logger?: Logger;

  constructor(
    permissionsOrOptions?: PermissionManager | OsPermissionBrokerOptions,
  ) {
    if (permissionsOrOptions && "requestPermission" in permissionsOrOptions) {
      this.permissions = permissionsOrOptions;
      this.publisher = undefined;
      this.logger = undefined;
    } else {
      const opts = permissionsOrOptions ?? {};
      this.permissions = opts.permissions ?? getDefaultPermissionManager();
      this.publisher = opts.onPlatformEvent;
      this.logger = opts.logger;
    }
  }

  getPermissionManager(): PermissionManager {
    return this.permissions;
  }

  authorize(input: OsAuthorizeInput): void {
    const check = this.permissions.requestPermission({
      capability: input.capability,
      reason: input.reason,
      resource: input.resource,
    });
    if (check.blocked) {
      const reason =
        check.evaluation.message ||
        `Permission denied for ${input.operation} (${input.capability})`;
      emitPlatformEvent(this.publisher, "PermissionDenied", {
        operation: input.operation,
        capability: input.capability,
        approvalId: check.approval?.id,
        reason,
      });
      platformSecurityLog(this.logger, "warn", "OS permission denied", {
        operation: input.operation,
        capability: input.capability,
        reason,
        ...(check.approval?.id !== undefined
          ? { approvalId: check.approval.id }
          : {}),
      });
      throw new PlatformError("permission_denied", reason, {
        approvalId: check.approval?.id,
      });
    }
    platformSecurityLog(this.logger, "debug", "OS permission allowed", {
      operation: input.operation,
      capability: input.capability,
    });
  }

  /** Emit PlatformProviderFailed for non-permission PlatformErrors. */
  emitProviderFailed(operation: string, error: unknown): void {
    if (!isPlatformError(error) || error.code === "permission_denied") {
      return;
    }
    emitPlatformEvent(this.publisher, "PlatformProviderFailed", {
      operation,
      code: error.code,
      category: error.category,
      message: error.message,
      ...(error.detail !== undefined ? { detail: error.detail } : {}),
    });
    platformLogError(this.logger, "Platform provider failed", error, {
      operation,
      code: error.code,
      category: error.category,
      message: error.message,
      ...(error.detail !== undefined ? { detail: error.detail } : {}),
    });
  }
}

function runSyncGated<T>(
  broker: OsPermissionBroker,
  operation: string,
  fn: () => T,
): T {
  try {
    return fn();
  } catch (error) {
    broker.emitProviderFailed(operation, error);
    throw error;
  }
}

async function runAsyncGated<T>(
  broker: OsPermissionBroker,
  operation: string,
  fn: () => T | Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    broker.emitProviderFailed(operation, error);
    throw error;
  }
}

function wrapApplications(
  inner: ApplicationService,
  broker: OsPermissionBroker,
): ApplicationService {
  return {
    async open(appIdOrPath) {
      broker.authorize({
        operation: "applications.open",
        capability: "application.control",
        reason: "Open application or path",
        resource: appIdOrPath,
      });
      return runAsyncGated(broker, "applications.open", () =>
        inner.open(appIdOrPath),
      );
    },
    async listRunning() {
      broker.authorize({
        operation: "applications.listRunning",
        capability: "application.control",
        reason: "List running applications",
      });
      return runAsyncGated(broker, "applications.listRunning", () =>
        inner.listRunning(),
      );
    },
    async focus(pidOrId) {
      broker.authorize({
        operation: "applications.focus",
        capability: "application.control",
        reason: "Focus application window",
        resource: String(pidOrId),
      });
      return runAsyncGated(broker, "applications.focus", () =>
        inner.focus(pidOrId),
      );
    },
    async quit(pidOrId) {
      broker.authorize({
        operation: "applications.quit",
        capability: "application.control",
        reason: "Quit application",
        resource: String(pidOrId),
      });
      return runAsyncGated(broker, "applications.quit", () =>
        inner.quit(pidOrId),
      );
    },
  };
}

function wrapFiles(
  inner: FileSystemService,
  broker: OsPermissionBroker,
): FileSystemService {
  return {
    exists(path) {
      broker.authorize({
        operation: "files.exists",
        capability: "filesystem.read",
        reason: "Check path existence",
        resource: path,
      });
      return runSyncGated(broker, "files.exists", () => inner.exists(path));
    },
    readText(path) {
      broker.authorize({
        operation: "files.readText",
        capability: "filesystem.read",
        reason: "Read file contents",
        resource: path,
      });
      return runSyncGated(broker, "files.readText", () => inner.readText(path));
    },
    readBytes(path, opts) {
      broker.authorize({
        operation: "files.readBytes",
        capability: "filesystem.read",
        reason: "Read file bytes",
        resource: path,
      });
      return runSyncGated(broker, "files.readBytes", () =>
        inner.readBytes(path, opts),
      );
    },
    writeText(path, data, mode) {
      broker.authorize({
        operation: "files.writeText",
        capability: "filesystem.write",
        reason: "Write file contents",
        resource: path,
      });
      return runSyncGated(broker, "files.writeText", () =>
        inner.writeText(path, data, mode),
      );
    },
    writeBytes(path, data, opts) {
      broker.authorize({
        operation: "files.writeBytes",
        capability: "filesystem.write",
        reason: "Write file bytes",
        resource: path,
      });
      return runSyncGated(broker, "files.writeBytes", () =>
        inner.writeBytes(path, data, opts),
      );
    },
    appendBytes(path, data) {
      broker.authorize({
        operation: "files.appendBytes",
        capability: "filesystem.write",
        reason: "Append file bytes",
        resource: path,
      });
      return runSyncGated(broker, "files.appendBytes", () =>
        inner.appendBytes(path, data),
      );
    },
    rename(from, to) {
      broker.authorize({
        operation: "files.rename",
        capability: "filesystem.write",
        reason: "Rename path",
        resource: to,
      });
      return runSyncGated(broker, "files.rename", () => inner.rename(from, to));
    },
    copyFile(from, to) {
      broker.authorize({
        operation: "files.copyFile",
        capability: "filesystem.write",
        reason: "Copy file",
        resource: to,
      });
      return runSyncGated(broker, "files.copyFile", () =>
        inner.copyFile(from, to),
      );
    },
    mkdirp(path) {
      broker.authorize({
        operation: "files.mkdirp",
        capability: "filesystem.write",
        reason: "Create directory",
        resource: path,
      });
      return runSyncGated(broker, "files.mkdirp", () => inner.mkdirp(path));
    },
    remove(path) {
      broker.authorize({
        operation: "files.remove",
        capability: "filesystem.delete",
        reason: "Remove path",
        resource: path,
      });
      return runSyncGated(broker, "files.remove", () => inner.remove(path));
    },
    listDir(path) {
      broker.authorize({
        operation: "files.listDir",
        capability: "filesystem.read",
        reason: "List directory",
        resource: path,
      });
      return runSyncGated(broker, "files.listDir", () => inner.listDir(path));
    },
    stat(path) {
      broker.authorize({
        operation: "files.stat",
        capability: "filesystem.read",
        reason: "Stat path",
        resource: path,
      });
      return runSyncGated(broker, "files.stat", () => inner.stat(path));
    },
    lstat(path) {
      broker.authorize({
        operation: "files.lstat",
        capability: "filesystem.read",
        reason: "Lstat path",
        resource: path,
      });
      return runSyncGated(broker, "files.lstat", () => inner.lstat(path));
    },
    readlink(path) {
      broker.authorize({
        operation: "files.readlink",
        capability: "filesystem.read",
        reason: "Read symlink target",
        resource: path,
      });
      return runSyncGated(broker, "files.readlink", () => inner.readlink(path));
    },
  };
}

function wrapTerminal(
  inner: TerminalService,
  broker: OsPermissionBroker,
): TerminalService {
  return {
    async execute(command, args, options) {
      broker.authorize({
        operation: "terminal.execute",
        capability: "terminal.execute",
        reason: "Execute terminal command",
        resource: command,
      });
      return runAsyncGated(broker, "terminal.execute", () =>
        inner.execute(command, args, options),
      );
    },
  };
}

function wrapNotifications(
  inner: NotificationService,
  broker: OsPermissionBroker,
): NotificationService {
  return {
    async show(input) {
      broker.authorize({
        operation: "notifications.show",
        capability: "notifications.show",
        reason: "Show desktop notification",
        resource: input.title,
      });
      return runAsyncGated(broker, "notifications.show", () =>
        inner.show(input),
      );
    },
  };
}

function wrapClipboard(
  inner: ClipboardService,
  broker: OsPermissionBroker,
): ClipboardService {
  return {
    async readText() {
      broker.authorize({
        operation: "clipboard.readText",
        capability: "clipboard.read",
        reason: "Read clipboard text",
      });
      return runAsyncGated(broker, "clipboard.readText", () =>
        inner.readText(),
      );
    },
    async writeText(text) {
      broker.authorize({
        operation: "clipboard.writeText",
        capability: "clipboard.write",
        reason: "Write clipboard text",
      });
      return runAsyncGated(broker, "clipboard.writeText", () =>
        inner.writeText(text),
      );
    },
  };
}

function wrapSystem(
  inner: SystemInformationService,
  broker: OsPermissionBroker,
): SystemInformationService {
  return {
    getPlatform() {
      broker.authorize({
        operation: "system.getPlatform",
        capability: "system.info",
        reason: "Read platform information",
      });
      return runSyncGated(broker, "system.getPlatform", () =>
        inner.getPlatform(),
      );
    },
    getHostname() {
      broker.authorize({
        operation: "system.getHostname",
        capability: "system.info",
        reason: "Read hostname",
      });
      return runSyncGated(broker, "system.getHostname", () =>
        inner.getHostname(),
      );
    },
    getUptime() {
      broker.authorize({
        operation: "system.getUptime",
        capability: "system.info",
        reason: "Read system uptime",
      });
      return runSyncGated(broker, "system.getUptime", () => inner.getUptime());
    },
  };
}

/**
 * Wrap an OperatingSystem so privileged methods authorize through the broker.
 * `paths` and `env` pass through ungated (bootstrap/infra).
 */
export function wrapOperatingSystemWithBroker(
  os: OperatingSystem,
  broker: OsPermissionBroker,
): OperatingSystem {
  return {
    applications: wrapApplications(os.applications, broker),
    files: wrapFiles(os.files, broker),
    terminal: wrapTerminal(os.terminal, broker),
    notifications: wrapNotifications(os.notifications, broker),
    clipboard: wrapClipboard(os.clipboard, broker),
    system: wrapSystem(os.system, broker),
    paths: os.paths,
    env: os.env,
  };
}
