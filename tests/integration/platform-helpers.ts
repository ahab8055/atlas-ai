/**
 * Shared harness for Phase 4 Platform Abstraction integration tests.
 * Forces darwin/linux/win32 via mock runners — CI-safe on any host.
 */
import { expect } from "vitest";

import {
  EventBus,
  PLATFORM_EVENTS,
  createPlatformEventPublisher,
  fromUnknown,
} from "@atlas-ai/core";
import { PermissionManager } from "@atlas-ai/security";
import {
  PLATFORM_EVENTS as PLATFORM_EVENTS_FROM_PLATFORM,
  __resetDefaultPlatformManagerForTests,
  __resetDefaultPlatformServiceRegistryForTests,
  PlatformError,
  bootstrapPlatformServices,
  createNodeEnvService,
  getDefaultPlatformManager,
  isPlatformError,
  platformIdToOs,
  type OperatingSystem,
  type PlatformEventPublisher,
  type PlatformEventType,
  type PlatformId,
  type PlatformManager,
  type PlatformServiceKey,
  type PlatformServiceRegistry,
} from "@atlas-ai/platform";

export const PLATFORM_IDS: readonly PlatformId[] = [
  "darwin",
  "linux",
  "win32",
] as const;

export const PLATFORM_SERVICE_KEYS: readonly PlatformServiceKey[] = [
  "info",
  "paths",
  "env",
  "fs",
  "os",
  "os.applications",
  "os.files",
  "os.terminal",
  "os.notifications",
  "os.clipboard",
  "os.system",
  "os.paths",
  "os.env",
] as const;

export type MockCommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

export type MockRunnerHandler = (
  command: string,
  args: string[],
  options?: { input?: string },
) => Promise<MockCommandResult> | MockCommandResult;

export interface PlatformHarnessOptions {
  platformId: PlatformId;
  enforceOsPermissions?: boolean;
  permissionManager?: PermissionManager;
  onPlatformEvent?: PlatformEventPublisher;
  /** Override default success mock behavior. */
  runnerHandler?: MockRunnerHandler;
  homeDir?: string;
}

export interface PlatformHarness {
  platformId: PlatformId;
  manager: PlatformManager;
  registry: PlatformServiceRegistry;
  runnerCalls: Array<{ command: string; args: string[] }>;
  setRunnerHandler: (handler: MockRunnerHandler) => void;
  cleanup: () => void;
}

function defaultRunnerHandler(platformId: PlatformId): MockRunnerHandler {
  return async (command, args) => {
    if (platformId === "linux" && command === "ps") {
      return { stdout: "  1 init\n  2 bash\n", stderr: "", exitCode: 0 };
    }
    if (platformId === "darwin" && command === "osascript") {
      const script = args.join(" ");
      if (script.includes("process") || script.includes("unix id")) {
        return {
          stdout: "1,Finder,2,TextEdit",
          stderr: "",
          exitCode: 0,
        };
      }
    }
    if (platformId === "win32" && command === "powershell.exe") {
      const joined = args.join(" ");
      if (joined.includes("Get-Clipboard")) {
        return { stdout: "clip\r\n", stderr: "", exitCode: 0 };
      }
      if (joined.includes("Get-Process")) {
        return {
          stdout: JSON.stringify([
            { Id: 1, ProcessName: "explorer", Path: null },
          ]),
          stderr: "",
          exitCode: 0,
        };
      }
    }
    if (
      (platformId === "linux" && command === "xclip" && args.includes("-o")) ||
      (platformId === "linux" && command === "wl-paste") ||
      (platformId === "darwin" && command === "pbpaste")
    ) {
      return { stdout: "clip", stderr: "", exitCode: 0 };
    }
    return { stdout: "", stderr: "", exitCode: 0 };
  };
}

function createTrackingRunner(
  calls: Array<{ command: string; args: string[] }>,
  getHandler: () => MockRunnerHandler,
) {
  return {
    async run(command: string, args: string[], options?: { input?: string }) {
      calls.push({ command, args });
      return getHandler()(command, args, options);
    },
  };
}

export function createPlatformHarness(
  options: PlatformHarnessOptions,
): PlatformHarness {
  const platformId = options.platformId;
  const runnerCalls: Array<{ command: string; args: string[] }> = [];
  let handler = options.runnerHandler ?? defaultRunnerHandler(platformId);
  const runner = createTrackingRunner(runnerCalls, () => handler);

  const homeDir =
    options.homeDir ??
    (platformId === "win32" ? "C:\\Users\\test" : "/home/test");

  const env =
    platformId === "win32"
      ? createNodeEnvService({
          APPDATA: "C:\\Users\\test\\AppData\\Roaming",
          LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local",
        })
      : platformId === "linux"
        ? createNodeEnvService({
            XDG_SESSION_TYPE: "x11",
            DISPLAY: ":0",
          })
        : createNodeEnvService({});

  const registry = bootstrapPlatformServices({
    platformId,
    enforceOsPermissions: options.enforceOsPermissions ?? false,
    permissionManager: options.permissionManager,
    onPlatformEvent: options.onPlatformEvent,
    homeDir,
    env,
    ...(platformId === "darwin" ? { darwinRunner: runner } : {}),
    ...(platformId === "linux" ? { linuxRunner: runner } : {}),
    ...(platformId === "win32" ? { windowsRunner: runner } : {}),
  });

  const manager = getDefaultPlatformManager();

  return {
    platformId,
    manager,
    registry,
    runnerCalls,
    setRunnerHandler(next) {
      handler = next;
    },
    cleanup() {
      __resetDefaultPlatformServiceRegistryForTests();
      __resetDefaultPlatformManagerForTests();
    },
  };
}

/** Runtime structural compliance for OperatingSystem (not TypeScript-only). */
export function assertOperatingSystemCompliance(os: OperatingSystem): void {
  for (const key of [
    "applications",
    "files",
    "terminal",
    "notifications",
    "clipboard",
    "system",
    "paths",
    "env",
  ] as const) {
    expect(os[key], `missing os.${key}`).toBeDefined();
  }

  expect(typeof os.applications.open).toBe("function");
  expect(typeof os.applications.listRunning).toBe("function");
  expect(typeof os.applications.focus).toBe("function");
  expect(typeof os.applications.quit).toBe("function");

  expect(typeof os.files.exists).toBe("function");
  expect(typeof os.files.readText).toBe("function");
  expect(typeof os.files.writeText).toBe("function");
  expect(typeof os.files.mkdirp).toBe("function");
  expect(typeof os.files.remove).toBe("function");
  expect(typeof os.files.listDir).toBe("function");
  expect(typeof os.files.stat).toBe("function");
  expect(typeof os.files.lstat).toBe("function");
  expect(typeof os.files.readlink).toBe("function");
  expect(typeof os.files.readBytes).toBe("function");
  expect(typeof os.files.writeBytes).toBe("function");
  expect(typeof os.files.appendBytes).toBe("function");
  expect(typeof os.files.rename).toBe("function");

  expect(typeof os.terminal.execute).toBe("function");
  expect(typeof os.notifications.show).toBe("function");
  expect(typeof os.clipboard.readText).toBe("function");
  expect(typeof os.clipboard.writeText).toBe("function");

  expect(typeof os.system.getPlatform).toBe("function");
  expect(typeof os.system.getHostname).toBe("function");
  expect(typeof os.system.getUptime).toBe("function");

  expect(typeof os.paths.homeDir).toBe("function");
  expect(typeof os.paths.tempDir).toBe("function");
  expect(typeof os.paths.userDataDir).toBe("function");
  expect(typeof os.paths.cacheDir).toBe("function");
  expect(typeof os.paths.cwd).toBe("function");
  expect(typeof os.paths.join).toBe("function");

  expect(typeof os.env.get).toBe("function");
  expect(typeof os.env.getOr).toBe("function");
}

export function assertPlatformServiceKeyMatrix(
  registry: PlatformServiceRegistry,
): void {
  for (const key of PLATFORM_SERVICE_KEYS) {
    expect(registry.has(key), `has(${key})`).toBe(true);
    expect(registry.resolve(key), `resolve(${key})`).toBeDefined();
  }
  const os = registry.getOs();
  expect(registry.resolve("os")).toBe(os);
  expect(registry.resolve("os.applications")).toBe(os.applications);
  expect(registry.resolve("os.files")).toBe(os.files);
  expect(registry.resolve("os.terminal")).toBe(os.terminal);
  expect(registry.resolve("os.notifications")).toBe(os.notifications);
  expect(registry.resolve("os.clipboard")).toBe(os.clipboard);
  expect(registry.resolve("os.system")).toBe(os.system);
  expect(registry.resolve("os.paths")).toBe(os.paths);
  expect(registry.resolve("os.env")).toBe(os.env);
  expect(registry.getPaths()).toBe(registry.resolve("paths"));
  expect(registry.getEnv()).toBe(registry.resolve("env"));
  expect(registry.getFs()).toBe(registry.resolve("fs"));
  expect(registry.getInfo()).toBe(registry.resolve("info"));
}

export function createEventCollector(): {
  publisher: PlatformEventPublisher;
  events: Array<{ type: PlatformEventType; payload: unknown }>;
  types: () => PlatformEventType[];
  bus: EventBus;
  busPublisher: PlatformEventPublisher;
} {
  const events: Array<{ type: PlatformEventType; payload: unknown }> = [];
  const publisher: PlatformEventPublisher = {
    publish(type, payload) {
      events.push({ type, payload });
    },
  };
  const bus = new EventBus({ historyLimit: 50 });
  return {
    publisher,
    events,
    types: () => events.map((e) => e.type),
    bus,
    busPublisher: createPlatformEventPublisher(bus),
  };
}

export function assertPlatformCatalog(): void {
  expect(PLATFORM_EVENTS).toEqual([
    "PlatformDetected",
    "PlatformServicesStarted",
    "PermissionDenied",
    "PlatformProviderFailed",
  ]);
  expect(PLATFORM_EVENTS_FROM_PLATFORM).toEqual([...PLATFORM_EVENTS]);
}

export {
  PermissionManager,
  PlatformError,
  fromUnknown,
  isPlatformError,
  platformIdToOs,
};
