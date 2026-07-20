import { afterEach, describe, expect, it, vi } from "vitest";

import { PermissionManager } from "@atlas-ai/security";
import type { Logger, LogMethodOptions } from "@atlas-ai/logging";

import { __resetDefaultPlatformManagerForTests } from "./manager.js";
import {
  __resetDefaultPlatformServiceRegistryForTests,
  bootstrapPlatformServices,
} from "./registry.js";
import { createPlatformManager } from "./manager.js";
import { PlatformError } from "./os/errors.js";
import {
  OsPermissionBroker,
  wrapOperatingSystemWithBroker,
} from "./os/permission-broker.js";
import { createNodeEnvService } from "./node/shared.js";
import { createPathService } from "./node/paths.js";
import { createLinuxOperatingSystem } from "./os/linux/index.js";
import type { LinuxCommandRunner } from "./os/linux/runner.js";

type LogCall = {
  level: string;
  message: string;
  options?: LogMethodOptions;
  error?: unknown;
};

function createRecordingLogger(level = "debug"): {
  logger: Logger;
  calls: LogCall[];
} {
  const calls: LogCall[] = [];
  const logger = {
    child() {
      return logger;
    },
    trace(message: string, options?: LogMethodOptions) {
      calls.push({ level: "trace", message, options });
    },
    debug(message: string, options?: LogMethodOptions) {
      calls.push({ level: "debug", message, options });
    },
    info(message: string, options?: LogMethodOptions) {
      calls.push({ level: "info", message, options });
    },
    warn(message: string, options?: LogMethodOptions) {
      calls.push({ level: "warn", message, options });
    },
    error(message: string, options?: LogMethodOptions) {
      calls.push({ level: "error", message, options });
    },
    critical(message: string, options?: LogMethodOptions) {
      calls.push({ level: "critical", message, options });
    },
    logError(
      message: string,
      error: unknown,
      options?: Omit<LogMethodOptions, "error">,
    ) {
      calls.push({ level: "error", message, options, error });
    },
  } as unknown as Logger;
  void level;
  return { logger, calls };
}

function buildOs(runner: LinuxCommandRunner) {
  const env = createNodeEnvService({});
  const paths = createPathService("linux", { env, homeDir: "/home/test" });
  return createLinuxOperatingSystem({
    info: {
      id: "linux",
      os: "linux",
      arch: "x64",
      kernelVersion: "6.1.0",
      osType: "Linux",
      runtime: { kind: "node", version: "22.0.0" },
    },
    paths,
    env,
    runner,
  });
}

afterEach(() => {
  __resetDefaultPlatformServiceRegistryForTests();
  __resetDefaultPlatformManagerForTests();
});

describe("platform diagnostics", () => {
  it("logs provider load and init on PlatformManager.create", () => {
    const { logger, calls } = createRecordingLogger();
    createPlatformManager({
      platformId: "linux",
      enforceOsPermissions: false,
      logger,
    });

    const infoCalls = calls.filter((c) => c.level === "info");
    expect(infoCalls.map((c) => c.message)).toEqual([
      "Platform provider loaded",
      "Platform initialized",
    ]);
    expect(infoCalls[0]?.options?.context).toMatchObject({
      platformId: "linux",
    });
    expect(
      calls.some(
        (c) => c.level === "debug" && c.message === "OS permission broker wrap",
      ),
    ).toBe(true);
  });

  it("logs services started on bootstrap", () => {
    const { logger, calls } = createRecordingLogger();
    bootstrapPlatformServices({
      platformId: "linux",
      enforceOsPermissions: false,
      logger,
    });

    expect(
      calls.some(
        (c) =>
          c.level === "info" &&
          c.message === "Platform services started" &&
          c.options?.context?.via === "bootstrap",
      ),
    ).toBe(true);
  });

  it("warns on permission deny and debugs on allow", async () => {
    const { logger, calls } = createRecordingLogger();
    const broker = new OsPermissionBroker({
      permissions: new PermissionManager(),
      logger,
    });
    const os = wrapOperatingSystemWithBroker(
      buildOs({
        async run() {
          return { stdout: "", stderr: "", exitCode: 0 };
        },
      }),
      broker,
    );

    await expect(os.applications.open("firefox")).rejects.toMatchObject({
      code: "permission_denied",
    });
    expect(
      calls.some(
        (c) =>
          c.level === "warn" &&
          c.message === "OS permission denied" &&
          c.options?.category === "security" &&
          c.options?.context?.capability === "application.control",
      ),
    ).toBe(true);

    const allowCallsBefore = calls.length;
    const allowed = new OsPermissionBroker({
      permissions: new PermissionManager({
        grantedCapabilities: ["system.info"],
      }),
      logger,
    });
    wrapOperatingSystemWithBroker(
      buildOs({
        async run() {
          return { stdout: "", stderr: "", exitCode: 0 };
        },
      }),
      allowed,
    ).system.getPlatform();

    expect(
      calls
        .slice(allowCallsBefore)
        .some(
          (c) =>
            c.level === "debug" &&
            c.message === "OS permission allowed" &&
            c.options?.category === "security",
        ),
    ).toBe(true);
  });

  it("logError includes PlatformError detail on provider failure", async () => {
    const { logger, calls } = createRecordingLogger();
    const broker = new OsPermissionBroker({
      permissions: new PermissionManager({
        grantedCapabilities: ["application.control"],
      }),
      logger,
    });
    const inner = buildOs({
      async run() {
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    });
    vi.spyOn(inner.applications, "open").mockRejectedValue(
      new PlatformError("io_error", "spawn failed", {
        detail: { errno: "ENOENT", syscall: "spawn", platform: "linux" },
      }),
    );
    const os = wrapOperatingSystemWithBroker(inner, broker);

    await expect(os.applications.open("firefox")).rejects.toMatchObject({
      code: "io_error",
    });

    const fail = calls.find(
      (c) => c.message === "Platform provider failed" && c.level === "error",
    );
    expect(fail).toBeDefined();
    expect(fail?.options?.context).toMatchObject({
      operation: "applications.open",
      code: "io_error",
      detail: { errno: "ENOENT", syscall: "spawn" },
    });
    expect(fail?.error).toBeInstanceOf(PlatformError);
  });

  it("does not throw when logger is absent", () => {
    expect(() =>
      createPlatformManager({
        platformId: "linux",
        enforceOsPermissions: false,
      }),
    ).not.toThrow();
  });
});
