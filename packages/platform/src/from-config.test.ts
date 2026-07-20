import { describe, expect, it } from "vitest";

import { PermissionManager } from "@atlas-ai/security";

import { toPlatformManagerOptions } from "./from-config.js";
import { createPlatformManager } from "./manager.js";

describe("toPlatformManagerOptions", () => {
  it("maps forcePlatformId and osPermissionBroker", () => {
    const options = toPlatformManagerOptions({
      forcePlatformId: "linux",
      features: {
        osPermissionBroker: false,
        platformEvents: true,
      },
    });
    expect(options.platformId).toBe("linux");
    expect(options.enforceOsPermissions).toBe(false);
  });

  it("omits platformId when forcePlatformId is unset", () => {
    const options = toPlatformManagerOptions({
      features: {
        osPermissionBroker: true,
        platformEvents: false,
      },
    });
    expect(options.platformId).toBeUndefined();
    expect(options.enforceOsPermissions).toBe(true);
  });

  it("passes through extras", () => {
    const permissions = new PermissionManager();
    const options = toPlatformManagerOptions(
      {
        features: {
          osPermissionBroker: true,
          platformEvents: true,
        },
      },
      { permissionManager: permissions },
    );
    expect(options.permissionManager).toBe(permissions);
  });

  it("disables broker when osPermissionBroker is false", async () => {
    const calls: string[] = [];
    const permissions = new PermissionManager();
    const manager = createPlatformManager(
      toPlatformManagerOptions(
        {
          forcePlatformId: "linux",
          features: {
            osPermissionBroker: false,
            platformEvents: false,
          },
        },
        {
          permissionManager: permissions,
          linuxRunner: {
            async run(command) {
              calls.push(command);
              return { stdout: "", stderr: "", exitCode: 0 };
            },
          },
        },
      ),
    );

    await manager.getServices().os.applications.open("firefox");
    expect(calls).toContain("gtk-launch");
    expect(permissions.listDecisions()).toHaveLength(0);
  });
});
