import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { createPlatformManager } from "../manager.js";
import { PlatformError, isPlatformError } from "./errors.js";
import { createNodeFileSystemService } from "./node-files.js";
import type { ClipboardService } from "./types.js";

describe("OperatingSystem stubs", () => {
  it("throws not_implemented for computer-control capabilities", async () => {
    // Linux still uses stubs; Windows/darwin providers are real (ADR-0063/0064).
    const os = createPlatformManager({ platformId: "linux" }).getServices().os;
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
      expect(st.size).toBeGreaterThan(0);
      files.remove(file);
      expect(files.exists(file)).toBe(false);
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
    });
    expect(await manager.getServices().os.clipboard.readText()).toBe(
      "injected",
    );
  });
});
