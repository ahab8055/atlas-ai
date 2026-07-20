import { afterEach, describe, expect, it } from "vitest";

import {
  __resetDefaultPlatformManagerForTests,
  __resetDefaultPlatformServiceRegistryForTests,
  bootstrapPlatformServices,
  createPlatformManager,
  getDefaultPlatformServiceRegistry,
  PlatformServiceRegistry,
  setDefaultPlatformServiceRegistry,
} from "./index.js";

afterEach(() => {
  __resetDefaultPlatformServiceRegistryForTests();
  __resetDefaultPlatformManagerForTests();
});

describe("PlatformServiceRegistry", () => {
  it("bootstrapPlatformServices registers os and typed getters", () => {
    const registry = bootstrapPlatformServices({
      platformId: "linux",
      enforceOsPermissions: false,
    });
    expect(registry.resolve("os")).toBeDefined();
    expect(registry.getOs()).toBe(registry.resolve("os"));
    expect(registry.resolve("os.applications")).toBeDefined();
    expect(registry.getInfo().id).toBe("linux");
    expect(registry.has("paths")).toBe(true);
  });

  it("rejects double register without replace", () => {
    const registry = new PlatformServiceRegistry();
    const manager = createPlatformManager({
      platformId: "linux",
      enforceOsPermissions: false,
    });
    registry.registerFromManager(manager);
    expect(() => registry.registerFromManager(manager)).toThrow(
      /already registered/,
    );
    registry.registerFromManager(manager, { replace: true });
    expect(registry.getInfo().id).toBe("linux");
  });

  it("setDefaultPlatformServiceRegistry is used by getDefault", () => {
    const custom = new PlatformServiceRegistry();
    custom.registerFromManager(
      createPlatformManager({
        platformId: "win32",
        enforceOsPermissions: false,
      }),
    );
    setDefaultPlatformServiceRegistry(custom);
    expect(getDefaultPlatformServiceRegistry().getInfo().id).toBe("win32");
    expect(getDefaultPlatformServiceRegistry().resolve("os.terminal")).toBe(
      custom.getOs().terminal,
    );
  });

  it("lazy-bootstraps after clear via default PlatformManager", () => {
    const registry = getDefaultPlatformServiceRegistry();
    registry.clear();
    const info = registry.getInfo();
    expect(info.id).toBeTruthy();
    expect(registry.resolve("os")).toBeDefined();
  });

  it("resolves nested os capability keys", () => {
    const registry = bootstrapPlatformServices({
      platformId: "darwin",
      enforceOsPermissions: false,
    });
    expect(registry.resolve("os.files")).toBe(registry.getOs().files);
    expect(registry.resolve("os.clipboard")).toBe(registry.getOs().clipboard);
    expect(registry.resolve("os.system")).toBe(registry.getOs().system);
  });

  it("tryResolve returns services and survives clear via lazy bootstrap", () => {
    const registry = bootstrapPlatformServices({
      platformId: "linux",
      enforceOsPermissions: false,
    });
    expect(registry.tryResolve("os")).toBe(registry.getOs());
    expect(registry.tryResolve("paths")).toBe(registry.getPaths());

    registry.clear();
    // clear + tryResolve lazy-bootstraps from default PlatformManager
    expect(registry.tryResolve("os")).toBeDefined();
  });

  it("resolves the full platform service key matrix", () => {
    const registry = bootstrapPlatformServices({
      platformId: "linux",
      enforceOsPermissions: false,
    });
    const keys = [
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
    for (const key of keys) {
      expect(registry.has(key)).toBe(true);
      expect(registry.resolve(key)).toBeDefined();
    }
    expect(registry.getPaths()).toBe(registry.resolve("paths"));
    expect(registry.getEnv()).toBe(registry.resolve("env"));
    expect(registry.getFs()).toBe(registry.resolve("fs"));
    expect(registry.getServices().os).toBe(registry.getOs());
  });
});
