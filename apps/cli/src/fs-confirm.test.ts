import { describe, expect, it } from "vitest";

import {
  clearFsConfirmHost,
  configureFsConfirmHost,
  createFileAccessService,
  createMemoryFileSystemService,
  withFsConfirmRetry,
} from "@atlas-ai/filesystem";
import { PlatformError } from "@atlas-ai/platform";
import { PermissionManager } from "@atlas-ai/security";

import { promptFsConfirm } from "./fs-confirm.js";

const ROOT = "/workspace";

describe("fs-confirm", () => {
  it("promptFsConfirm returns false when stdin is not a TTY", () => {
    const wasTty = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      configurable: true,
    });
    try {
      expect(
        promptFsConfirm({
          approvalId: "apr_1",
          capability: "filesystem.write",
          reason: "writeFile.create",
          message: "test",
          destructive: false,
        }),
      ).toBe(false);
    } finally {
      Object.defineProperty(process.stdin, "isTTY", {
        value: wasTty,
        configurable: true,
      });
    }
  });

  it("withFsConfirmRetry approves one-shot and retries write once", () => {
    clearFsConfirmHost();
    const permissions = new PermissionManager({
      grantedCapabilities: ["filesystem.read"],
    });
    const files = createMemoryFileSystemService({
      [ROOT]: null,
      [`${ROOT}/a.txt`]: "old",
    });
    const svc = createFileAccessService({
      files,
      roots: [ROOT],
      permissions,
      paths: {
        homeDir: () => "/home/test",
        tempDir: () => "/tmp",
        userDataDir: () => "/home/test/.atlas",
        cacheDir: () => "/home/test/.cache",
        cwd: () => ROOT,
        join: (...parts: string[]) => parts.join("/").replace(/\/+/g, "/"),
      },
    });

    let prompts = 0;
    configureFsConfirmHost({
      permissions,
      confirm: () => {
        prompts += 1;
        return true;
      },
    });

    try {
      const result = withFsConfirmRetry(() =>
        svc.writeFile("a.txt", "new", { mode: "overwrite" }),
      );
      expect(result.backedUp).toBe(true);
      expect(prompts).toBe(1);
      expect(svc.readFile("a.txt").content).toBe("new");

      expect(() =>
        withFsConfirmRetry(() =>
          svc.writeFile("a.txt", "newer", { mode: "overwrite" }),
        ),
      ).not.toThrow();
      // second overwrite prompts again (one-shot consumed)
      expect(prompts).toBe(2);
    } finally {
      clearFsConfirmHost();
    }
  });

  it("denied confirm leaves permission_denied", () => {
    clearFsConfirmHost();
    const permissions = new PermissionManager({
      grantedCapabilities: ["filesystem.read"],
    });
    const files = createMemoryFileSystemService({
      [ROOT]: null,
    });
    const svc = createFileAccessService({
      files,
      roots: [ROOT],
      permissions,
      paths: {
        homeDir: () => "/home/test",
        tempDir: () => "/tmp",
        userDataDir: () => "/home/test/.atlas",
        cacheDir: () => "/home/test/.cache",
        cwd: () => ROOT,
        join: (...parts: string[]) => parts.join("/").replace(/\/+/g, "/"),
      },
    });

    configureFsConfirmHost({
      permissions,
      confirm: () => false,
    });

    try {
      expect(() =>
        withFsConfirmRetry(() => svc.writeFile("b.txt", "x")),
      ).toThrow(PlatformError);
    } finally {
      clearFsConfirmHost();
    }
  });
});
