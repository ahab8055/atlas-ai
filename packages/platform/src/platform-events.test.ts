import { describe, expect, it, vi } from "vitest";

import { PermissionManager } from "@atlas-ai/security";

import { createPlatformManager } from "./manager.js";
import { __resetDefaultPlatformManagerForTests } from "./manager.js";
import {
  __resetDefaultPlatformServiceRegistryForTests,
  bootstrapPlatformServices,
} from "./registry.js";
import type {
  PlatformEventPayloadMap,
  PlatformEventPublisher,
  PlatformEventType,
} from "./events.js";
import { createNodeEnvService } from "./node/shared.js";
import { createPathService } from "./node/paths.js";
import { PlatformError } from "./os/errors.js";
import {
  OsPermissionBroker,
  wrapOperatingSystemWithBroker,
} from "./os/permission-broker.js";
import { createLinuxOperatingSystem } from "./os/linux/index.js";
import type { LinuxCommandRunner } from "./os/linux/runner.js";

function collectPublisher(): {
  publisher: PlatformEventPublisher;
  events: Array<{
    type: PlatformEventType;
    payload: PlatformEventPayloadMap[PlatformEventType];
  }>;
} {
  const events: Array<{
    type: PlatformEventType;
    payload: PlatformEventPayloadMap[PlatformEventType];
  }> = [];
  return {
    events,
    publisher: {
      publish(type, payload) {
        events.push({ type, payload });
      },
    },
  };
}

function mockRunner(
  handler: (
    command: string,
    args: string[],
  ) => { stdout: string; stderr: string; exitCode: number | null },
): LinuxCommandRunner {
  return {
    async run(command, args) {
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

describe("platform event emission", () => {
  it("emits PlatformDetected from PlatformManager.create", () => {
    const { publisher, events } = collectPublisher();
    createPlatformManager({
      platformId: "linux",
      enforceOsPermissions: false,
      onPlatformEvent: publisher,
    });

    expect(events).toContainEqual({
      type: "PlatformDetected",
      payload: expect.objectContaining({
        platformId: "linux",
        os: "linux",
        arch: expect.any(String),
      }),
    });
  });

  it("emits PlatformServicesStarted from bootstrapPlatformServices", () => {
    const { publisher, events } = collectPublisher();
    __resetDefaultPlatformServiceRegistryForTests();
    __resetDefaultPlatformManagerForTests();

    bootstrapPlatformServices({
      platformId: "linux",
      enforceOsPermissions: false,
      onPlatformEvent: publisher,
    });

    expect(events.map((e) => e.type)).toEqual([
      "PlatformDetected",
      "PlatformServicesStarted",
    ]);
    expect(events[1]).toEqual({
      type: "PlatformServicesStarted",
      payload: { platformId: "linux", via: "bootstrap" },
    });
  });

  it("emits PermissionDenied when broker blocks", async () => {
    const { publisher, events } = collectPublisher();
    const broker = new OsPermissionBroker({
      permissions: new PermissionManager(),
      onPlatformEvent: publisher,
    });
    const os = wrapOperatingSystemWithBroker(
      buildOs(mockRunner(() => ({ stdout: "", stderr: "", exitCode: 0 }))),
      broker,
    );

    await expect(os.applications.open("firefox")).rejects.toMatchObject({
      code: "permission_denied",
    });
    expect(events).toContainEqual({
      type: "PermissionDenied",
      payload: expect.objectContaining({
        operation: "applications.open",
        capability: "application.control",
        reason: expect.any(String),
      }),
    });
    expect(events.some((e) => e.type === "PlatformProviderFailed")).toBe(false);
  });

  it("emits PlatformProviderFailed when gated op throws PlatformError", async () => {
    const { publisher, events } = collectPublisher();
    const permissions = new PermissionManager({
      grantedCapabilities: ["application.control"],
    });
    const broker = new OsPermissionBroker({
      permissions,
      onPlatformEvent: publisher,
    });
    const inner = buildOs(
      mockRunner(() => ({ stdout: "", stderr: "", exitCode: 0 })),
    );
    vi.spyOn(inner.applications, "open").mockRejectedValue(
      new PlatformError("io_error", "spawn failed"),
    );
    const os = wrapOperatingSystemWithBroker(inner, broker);

    await expect(os.applications.open("firefox")).rejects.toMatchObject({
      code: "io_error",
    });
    expect(events).toContainEqual({
      type: "PlatformProviderFailed",
      payload: {
        operation: "applications.open",
        code: "io_error",
        category: "system",
        message: "spawn failed",
      },
    });
  });
});
