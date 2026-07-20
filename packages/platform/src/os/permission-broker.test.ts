import { describe, expect, it } from "vitest";

import { PermissionManager } from "@atlas-ai/security";

import { createPlatformManager } from "../manager.js";
import { createNodeEnvService } from "../node/shared.js";
import { createPathService } from "../node/paths.js";
import { PlatformError } from "./errors.js";
import {
  OsPermissionBroker,
  wrapOperatingSystemWithBroker,
} from "./permission-broker.js";
import { createLinuxOperatingSystem } from "./linux/index.js";
import type { LinuxCommandRunner } from "./linux/runner.js";

function mockRunner(
  handler: (
    command: string,
    args: string[],
  ) => { stdout: string; stderr: string; exitCode: number | null },
): LinuxCommandRunner & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    async run(command, args) {
      calls.push(command);
      return handler(command, args);
    },
  };
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

describe("OsPermissionBroker", () => {
  it("blocks unauthorized applications.open and does not call runner", async () => {
    const runner = mockRunner(() => ({
      stdout: "",
      stderr: "",
      exitCode: 0,
    }));
    const permissions = new PermissionManager();
    const broker = new OsPermissionBroker(permissions);
    const os = wrapOperatingSystemWithBroker(buildOs(runner), broker);

    await expect(os.applications.open("firefox")).rejects.toMatchObject({
      code: "permission_denied",
    });
    expect(runner.calls).toHaveLength(0);
    expect(
      permissions.listDecisions().some((d) => d.outcome === "blocked"),
    ).toBe(true);
  });

  it("exposes approvalId when L2 capability is blocked", async () => {
    const runner = mockRunner(() => ({
      stdout: "",
      stderr: "",
      exitCode: 0,
    }));
    const permissions = new PermissionManager();
    const broker = new OsPermissionBroker(permissions);
    const os = wrapOperatingSystemWithBroker(buildOs(runner), broker);

    try {
      await os.applications.open("firefox");
      expect.fail("expected permission_denied");
    } catch (error) {
      expect(error).toBeInstanceOf(PlatformError);
      expect((error as PlatformError).code).toBe("permission_denied");
      expect((error as PlatformError).approvalId).toBeTruthy();
    }
  });

  it("allows applications.open after grant and calls runner", async () => {
    const runner = mockRunner(() => ({
      stdout: "",
      stderr: "",
      exitCode: 0,
    }));
    const permissions = new PermissionManager({
      grantedCapabilities: ["application.control"],
    });
    const broker = new OsPermissionBroker(permissions);
    const os = wrapOperatingSystemWithBroker(buildOs(runner), broker);

    await os.applications.open("firefox");
    expect(runner.calls).toContain("gtk-launch");
    expect(
      permissions.listDecisions().some((d) => d.outcome === "allowed"),
    ).toBe(true);
  });

  it("allows system.getPlatform at L0 and logs the decision", () => {
    const runner = mockRunner(() => ({
      stdout: "",
      stderr: "",
      exitCode: 0,
    }));
    const permissions = new PermissionManager();
    const broker = new OsPermissionBroker(permissions);
    const os = wrapOperatingSystemWithBroker(buildOs(runner), broker);

    expect(os.system.getPlatform().id).toBe("linux");
    expect(
      permissions
        .listDecisions()
        .some(
          (d) =>
            d.request.capability === "system.info" && d.outcome === "allowed",
        ),
    ).toBe(true);
  });

  it("allows paths.homeDir without a grant", () => {
    const runner = mockRunner(() => ({
      stdout: "",
      stderr: "",
      exitCode: 0,
    }));
    const permissions = new PermissionManager();
    const broker = new OsPermissionBroker(permissions);
    const os = wrapOperatingSystemWithBroker(buildOs(runner), broker);

    expect(os.paths.homeDir()).toContain("test");
    expect(permissions.listDecisions()).toHaveLength(0);
  });

  it("PlatformManager enforces permissions by default", async () => {
    const calls: string[] = [];
    const permissions = new PermissionManager();
    const manager = createPlatformManager({
      platformId: "linux",
      permissionManager: permissions,
      linuxRunner: {
        async run(command) {
          calls.push(command);
          return { stdout: "", stderr: "", exitCode: 0 };
        },
      },
    });

    await expect(
      manager.getServices().os.applications.open("firefox"),
    ).rejects.toMatchObject({ code: "permission_denied" });
    expect(calls).toHaveLength(0);

    permissions.grant("application.control");
    await manager.getServices().os.applications.open("firefox");
    expect(calls).toContain("gtk-launch");
  });

  it("gates the wrap matrix until capabilities are granted", async () => {
    const runner = mockRunner(() => ({
      stdout: "ok",
      stderr: "",
      exitCode: 0,
    }));
    const permissions = new PermissionManager();
    const broker = new OsPermissionBroker(permissions);
    const os = wrapOperatingSystemWithBroker(buildOs(runner), broker);

    expect(() => os.files.readText("/tmp/a")).toThrow(
      /Grant permission for filesystem.read|permission_denied|Permission denied/i,
    );
    await expect(os.terminal.execute("echo", [])).rejects.toMatchObject({
      code: "permission_denied",
    });
    await expect(os.clipboard.readText()).rejects.toMatchObject({
      code: "permission_denied",
    });
    await expect(
      os.notifications.show({ title: "t", body: "" }),
    ).rejects.toMatchObject({ code: "permission_denied" });
    await expect(os.applications.listRunning()).rejects.toMatchObject({
      code: "permission_denied",
    });
    await expect(os.applications.focus(1)).rejects.toMatchObject({
      code: "permission_denied",
    });
    await expect(os.applications.quit(1)).rejects.toMatchObject({
      code: "permission_denied",
    });

    permissions.grant("filesystem.read");
    permissions.grant("terminal.execute");
    permissions.grant("clipboard.read");
    permissions.grant("notifications.show");
    permissions.grant("application.control");

    try {
      os.files.readText("/tmp/atlas-broker-matrix-test-missing");
    } catch (error) {
      expect(error).toBeInstanceOf(PlatformError);
      expect((error as PlatformError).code).not.toBe("permission_denied");
    }
    await os.terminal.execute("echo", []);
    await os.clipboard.readText();
    await os.notifications.show({ title: "t", body: "" });
    await os.applications.listRunning();
    await os.applications.focus(1);
    await os.applications.quit(1);
    expect(os.system.getHostname()).toBeTruthy();
  });

  it("uses an injected permissionBroker on PlatformManager", async () => {
    const calls: string[] = [];
    const permissions = new PermissionManager({
      grantedCapabilities: ["application.control"],
    });
    const broker = new OsPermissionBroker(permissions);
    const manager = createPlatformManager({
      platformId: "linux",
      permissionBroker: broker,
      linuxRunner: {
        async run(command) {
          calls.push(command);
          return { stdout: "", stderr: "", exitCode: 0 };
        },
      },
    });
    await manager.getServices().os.applications.open("firefox");
    expect(calls).toContain("gtk-launch");
  });
});
