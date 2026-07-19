/**
 * OsPermissionBroker — authorize privileged OS ops via PermissionManager (ADR-0066).
 */
import {
  getDefaultPermissionManager,
  type PermissionCapability,
  type PermissionManager,
} from "@atlas-ai/security";

import { PlatformError } from "./errors.js";
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

/**
 * Central gate for privileged OperatingSystem calls.
 * Logs every check via PermissionManager; throws when blocked.
 */
export class OsPermissionBroker {
  private readonly permissions: PermissionManager;

  constructor(permissions?: PermissionManager) {
    this.permissions = permissions ?? getDefaultPermissionManager();
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
      throw new PlatformError(
        "permission_denied",
        check.evaluation.message ||
          `Permission denied for ${input.operation} (${input.capability})`,
        { approvalId: check.approval?.id },
      );
    }
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
      return inner.open(appIdOrPath);
    },
    async listRunning() {
      broker.authorize({
        operation: "applications.listRunning",
        capability: "application.control",
        reason: "List running applications",
      });
      return inner.listRunning();
    },
    async focus(pidOrId) {
      broker.authorize({
        operation: "applications.focus",
        capability: "application.control",
        reason: "Focus application window",
        resource: String(pidOrId),
      });
      return inner.focus(pidOrId);
    },
    async quit(pidOrId) {
      broker.authorize({
        operation: "applications.quit",
        capability: "application.control",
        reason: "Quit application",
        resource: String(pidOrId),
      });
      return inner.quit(pidOrId);
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
      return inner.exists(path);
    },
    readText(path) {
      broker.authorize({
        operation: "files.readText",
        capability: "filesystem.read",
        reason: "Read file contents",
        resource: path,
      });
      return inner.readText(path);
    },
    writeText(path, data, mode) {
      broker.authorize({
        operation: "files.writeText",
        capability: "filesystem.write",
        reason: "Write file contents",
        resource: path,
      });
      return inner.writeText(path, data, mode);
    },
    mkdirp(path) {
      broker.authorize({
        operation: "files.mkdirp",
        capability: "filesystem.write",
        reason: "Create directory",
        resource: path,
      });
      return inner.mkdirp(path);
    },
    remove(path) {
      broker.authorize({
        operation: "files.remove",
        capability: "filesystem.delete",
        reason: "Remove path",
        resource: path,
      });
      return inner.remove(path);
    },
    listDir(path) {
      broker.authorize({
        operation: "files.listDir",
        capability: "filesystem.read",
        reason: "List directory",
        resource: path,
      });
      return inner.listDir(path);
    },
    stat(path) {
      broker.authorize({
        operation: "files.stat",
        capability: "filesystem.read",
        reason: "Stat path",
        resource: path,
      });
      return inner.stat(path);
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
      return inner.execute(command, args, options);
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
      return inner.show(input);
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
      return inner.readText();
    },
    async writeText(text) {
      broker.authorize({
        operation: "clipboard.writeText",
        capability: "clipboard.write",
        reason: "Write clipboard text",
      });
      return inner.writeText(text);
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
      return inner.getPlatform();
    },
    getHostname() {
      broker.authorize({
        operation: "system.getHostname",
        capability: "system.info",
        reason: "Read hostname",
      });
      return inner.getHostname();
    },
    getUptime() {
      broker.authorize({
        operation: "system.getUptime",
        capability: "system.info",
        reason: "Read system uptime",
      });
      return inner.getUptime();
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
