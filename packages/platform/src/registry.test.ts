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
});
