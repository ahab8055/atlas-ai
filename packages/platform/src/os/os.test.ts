import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createPlatformManager } from "../manager.js";
import { createNodeEnvService } from "../node/shared.js";
import { createPathService } from "../node/paths.js";
import { createNodeOperatingSystem } from "./create.js";
import { PlatformError, isPlatformError } from "./errors.js";
import { createNodeFileSystemService } from "./node-files.js";
import type { ClipboardService } from "./types.js";

describe("OperatingSystem stubs", () => {
  it("throws not_implemented for computer-control capabilities", async () => {
    // Generic Node OS still stubs computer-control; OS providers are real
    // (ADR-0063/0064/0065).
    const env = createNodeEnvService({});
    const paths = createPathService("linux", { env, homeDir: "/tmp" });
    const os = createNodeOperatingSystem({
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
    });
    await expect(os.applications.open("TextEdit")).rejects.toMatchObject({
      code: "not_implemented",
    });
    await expect(os.terminal.execute("echo", ["hi"])).rejects.toMatchObject({
      code: "not_implemented",
    });
    await expect(
      os.notifications.show({ title: "t", body: "b" }),
    ).rejects.toMatchObject({ code: "not_implemented" });
    await expect(os.clipboard.readText()).rejects.toMatchObject({
      code: "not_implemented",
    });

    try {
      await os.clipboard.writeText("x");
    } catch (error) {
      expect(isPlatformError(error)).toBe(true);
      expect((error as PlatformError).code).toBe("not_implemented");
    }
  });
});

describe("OperatingSystem files", () => {
  it("round-trips write/read/list/stat/remove", () => {
    const dir = mkdtempSync(join(tmpdir(), "atlas-os-fs-"));
    const files = createNodeFileSystemService();
    try {
      const file = join(dir, "note.txt");
      expect(files.exists(file)).toBe(false);
      files.writeText(file, "hello atlas");
      expect(files.exists(file)).toBe(true);
      expect(files.readText(file)).toBe("hello atlas");
      expect(files.listDir(dir)).toContain("note.txt");
      const st = files.stat(file);
      expect(st.isFile).toBe(true);
      expect(st.isSymbolicLink).toBe(false);
      expect(st.size).toBeGreaterThan(0);
      expect(typeof st.birthtimeMs).toBe("number");
      expect(typeof st.mode).toBe("number");
      expect(typeof st.uid).toBe("number");
      expect(files.readBytes(file)).toEqual(
        new TextEncoder().encode("hello atlas"),
      );
      expect(files.readBytes(file, { offset: 6, length: 5 })).toEqual(
        new TextEncoder().encode("atlas"),
      );
      const bytesPath = join(dir, "raw.bin");
      files.writeBytes(bytesPath, new Uint8Array([1, 2, 3]));
      expect(files.readBytes(bytesPath)).toEqual(new Uint8Array([1, 2, 3]));
      files.appendBytes(bytesPath, new Uint8Array([4, 5]));
      expect(files.readBytes(bytesPath)).toEqual(
        new Uint8Array([1, 2, 3, 4, 5]),
      );
      const renamed = join(dir, "renamed.bin");
      files.rename(bytesPath, renamed);
      expect(files.exists(bytesPath)).toBe(false);
      expect(files.readBytes(renamed)).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
      const copied = join(dir, "copied.bin");
      files.copyFile(renamed, copied);
      expect(files.readBytes(copied)).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
      files.remove(file);
      expect(files.exists(file)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("lstat and readlink report symbolic links", () => {
    const dir = mkdtempSync(join(tmpdir(), "atlas-os-link-"));
    const files = createNodeFileSystemService();
    try {
      const target = join(dir, "target.txt");
      const link = join(dir, "alias.txt");
      files.writeText(target, "linked");
      try {
        symlinkSync("target.txt", link);
      } catch {
        // Host may lack symlink permission (e.g. Windows without Developer Mode)
        return;
      }
      const lst = files.lstat(link);
      expect(lst.isSymbolicLink).toBe(true);
      expect(files.readlink(link)).toBe("target.txt");
      const followed = files.stat(link);
      expect(followed.isSymbolicLink).toBe(false);
      expect(followed.isFile).toBe(true);
      expect(files.readText(link)).toBe("linked");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("OperatingSystem system info", () => {
  it("returns detector-backed PlatformInfo from PlatformManager", () => {
    const manager = createPlatformManager({
      platformId: "linux",
      arch: "x64",
      kernelVersion: "6.1.0-test",
      nodeVersion: "22.0.0",
    });
    const platform = manager.getServices().os.system.getPlatform();
    expect(platform.id).toBe("linux");
    expect(platform.os).toBe("linux");
    expect(platform.arch).toBe("x64");
    expect(platform.kernelVersion).toBe("6.1.0-test");
    expect(platform.runtime.version).toBe("22.0.0");
    expect(typeof manager.getServices().os.system.getHostname()).toBe("string");
    expect(typeof manager.getServices().os.system.getUptime()).toBe("number");
  });
});

describe("OperatingSystem DI swap", () => {
  it("allows swapping clipboard via PlatformManager os override", async () => {
    const fake: ClipboardService = {
      async readText() {
        return "injected";
      },
      async writeText() {
        /* no-op */
      },
    };
    const manager = createPlatformManager({
      os: { clipboard: fake },
      enforceOsPermissions: false,
    });
    expect(await manager.getServices().os.clipboard.readText()).toBe(
      "injected",
    );
  });
});
