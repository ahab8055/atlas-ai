import { describe, expect, it } from "vitest";

import { detectPlatformId } from "./detect.js";
import {
  PlatformManager,
  __resetDefaultPlatformManagerForTests,
  createPlatformManager,
  getDefaultPlatformManager,
} from "./manager.js";
import { createNodeEnvService } from "./node/shared.js";
import { createPathService } from "./node/paths.js";
import { resolvePlatformPaths } from "./resolve-paths.js";
import type { PathService } from "./types.js";

describe("detectPlatformId", () => {
  it("maps known Node platforms", () => {
    expect(detectPlatformId("darwin")).toBe("darwin");
    expect(detectPlatformId("linux")).toBe("linux");
    expect(detectPlatformId("win32")).toBe("win32");
  });

  it("rejects unsupported platforms", () => {
    expect(() => detectPlatformId("freebsd")).toThrow(/Unsupported platform/);
  });
});

describe("PathService per PlatformId", () => {
  const home = "/Users/test";
  const env = createNodeEnvService({
    APPDATA: "C:\\Users\\test\\AppData\\Roaming",
    LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local",
    XDG_DATA_HOME: "/xdg/data",
    XDG_CACHE_HOME: "/xdg/cache",
  });

  it("resolves darwin Application Support and Caches", () => {
    const paths = createPathService("darwin", { env, homeDir: home });
    expect(paths.userDataDir()).toBe(
      "/Users/test/Library/Application Support/Atlas",
    );
    expect(paths.cacheDir()).toBe("/Users/test/Library/Caches/Atlas");
  });

  it("resolves linux XDG paths with lowercase app name", () => {
    const paths = createPathService("linux", { env, homeDir: home });
    expect(paths.userDataDir()).toBe("/xdg/data/atlas");
    expect(paths.cacheDir()).toBe("/xdg/cache/atlas");
  });

  it("resolves win32 APPDATA / LOCALAPPDATA", () => {
    const paths = createPathService("win32", { env, homeDir: home });
    expect(paths.userDataDir().replace(/\\/g, "/")).toContain(
      "AppData/Roaming/Atlas",
    );
    expect(paths.cacheDir().replace(/\\/g, "/")).toContain(
      "AppData/Local/Atlas/Cache",
    );
  });
});

describe("PlatformManager", () => {
  it("selects win32 paths when platformId is forced", () => {
    const manager = PlatformManager.create({
      platformId: "win32",
      homeDir: "C:\\Users\\test",
      env: createNodeEnvService({
        APPDATA: "C:\\Users\\test\\AppData\\Roaming",
        LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local",
      }),
    });
    expect(manager.platformId).toBe("win32");
    expect(manager.getServices().info.id).toBe("win32");
    expect(
      manager.getServices().paths.userDataDir().replace(/\\/g, "/"),
    ).toContain("AppData/Roaming/Atlas");
  });

  it("applies DI PathService override", () => {
    const custom: PathService = {
      homeDir: () => "/custom-home",
      tempDir: () => "/custom-tmp",
      userDataDir: () => "/custom-data",
      cacheDir: () => "/custom-cache",
      cwd: () => "/custom-cwd",
      join: (...parts) => parts.join("/"),
    };
    const manager = createPlatformManager({
      platformId: "darwin",
      services: { paths: custom },
    });
    expect(manager.getServices().paths.userDataDir()).toBe("/custom-data");
  });

  it("lazy default singleton returns services", () => {
    __resetDefaultPlatformManagerForTests();
    const a = getDefaultPlatformManager();
    const b = getDefaultPlatformManager();
    expect(a).toBe(b);
    expect(["darwin", "linux", "win32"]).toContain(a.platformId);
    __resetDefaultPlatformManagerForTests();
  });
});

describe("resolvePlatformPaths", () => {
  it("builds absolute layout under userDataDir", () => {
    const manager = createPlatformManager({
      platformId: "linux",
      homeDir: "/home/test",
      env: createNodeEnvService({}),
    });
    const resolved = resolvePlatformPaths(manager.getServices());
    expect(resolved.dataDir).toBe("/home/test/.local/share/atlas/data");
    expect(resolved.modelsDir).toBe("/home/test/.local/share/atlas/models");
    expect(resolved.databasePath).toBe(
      "/home/test/.local/share/atlas/data/atlas.sqlite",
    );
  });
});
