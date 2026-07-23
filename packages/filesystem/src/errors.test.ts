/**
 * FileSystemError taxonomy tests (ADR-0090).
 */
import { describe, expect, it } from "vitest";

import { PlatformError } from "@atlas-ai/platform";

import {
  createFileSystemError,
  fromPlatformErrorForFs,
  isFileSystemError,
  kindFromPlatformError,
  toAtlasFileSystemError,
} from "./errors.js";

describe("FileSystemError", () => {
  it("maps kinds to platform codes and tags detail.fsKind", () => {
    const cases = [
      ["permission_denied", "permission_denied"],
      ["file_not_found", "resource_not_found"],
      ["invalid_path", "invalid_input"],
      ["unsupported_type", "unsupported"],
      ["disk_full", "disk_full"],
      ["unknown", "unknown"],
    ] as const;

    for (const [kind, code] of cases) {
      const err = createFileSystemError(kind, `${kind} msg`);
      expect(isFileSystemError(err)).toBe(true);
      expect(err.kind).toBe(kind);
      expect(err.code).toBe(code);
      expect(err.detail?.fsKind).toBe(kind);
    }
  });

  it("builds Atlas-compatible objects with fs_* codes", () => {
    const err = createFileSystemError(
      "unsupported_type",
      "Unsupported binary file type",
    );
    const atlas = toAtlasFileSystemError(err);
    expect(atlas.id).toMatch(/^fserr_/);
    expect(atlas.category).toBe("tool");
    expect(atlas.code).toBe("fs_unsupported_type");
    expect(atlas.message).toContain("Unsupported");
    expect(atlas.userMessage.length).toBeGreaterThan(0);
    expect(atlas.recoverable).toBe(true);
    expect(atlas.recovery.length).toBeGreaterThan(0);
    expect(atlas.timestamp).toBeTruthy();
    expect(atlas.context?.fsKind).toBe("unsupported_type");
    expect(atlas.context?.platformCode).toBe("unsupported");
  });

  it("normalizes PlatformError via fromPlatformErrorForFs", () => {
    const platform = new PlatformError("disk_full", "no space", {
      detail: { errno: "ENOSPC", path: "/tmp/x" },
    });
    const fsErr = fromPlatformErrorForFs(platform);
    expect(fsErr.kind).toBe("disk_full");
    expect(kindFromPlatformError(platform)).toBe("disk_full");
    expect(toAtlasFileSystemError(platform).code).toBe("fs_disk_full");
  });
});
