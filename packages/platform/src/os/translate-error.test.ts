import { describe, expect, it } from "vitest";

import { PlatformError } from "./errors.js";
import { translateNativeError } from "./translate-error.js";

function errnoError(
  code: string,
  message: string,
  extras: { syscall?: string; path?: string } = {},
): NodeJS.ErrnoException {
  const err = new Error(message) as NodeJS.ErrnoException;
  err.code = code;
  err.syscall = extras.syscall;
  err.path = extras.path;
  return err;
}

describe("translateNativeError", () => {
  it("maps ENOENT to resource_not_found with resource category", () => {
    const native = errnoError("ENOENT", "ENOENT: no such file", {
      syscall: "open",
      path: "/missing.txt",
    });
    const err = translateNativeError(native, {
      operation: "files.readText",
      path: "/missing.txt",
      platform: "linux",
    });
    expect(err).toBeInstanceOf(PlatformError);
    expect(err.code).toBe("resource_not_found");
    expect(err.category).toBe("resource");
    expect(err.detail?.errno).toBe("ENOENT");
    expect(err.detail?.path).toBe("/missing.txt");
    expect(err.detail?.platform).toBe("linux");
    expect(err.cause).toBe(native);
    expect(err.message).toContain("files.readText");
  });

  it("maps EACCES to permission_denied with permission category", () => {
    const native = errnoError("EACCES", "permission denied", {
      syscall: "open",
    });
    const err = translateNativeError(native, {
      operation: "files.writeText",
      path: "/secret",
    });
    expect(err.code).toBe("permission_denied");
    expect(err.category).toBe("permission");
    expect(err.detail?.errno).toBe("EACCES");
  });

  it("maps EPERM to permission_denied", () => {
    const native = errnoError("EPERM", "operation not permitted");
    const err = translateNativeError(native, { operation: "spawn" });
    expect(err.code).toBe("permission_denied");
  });

  it("maps generic Error to io_error with system category", () => {
    const native = new Error("broken pipe");
    const err = translateNativeError(native, {
      operation: "Darwin command: x",
    });
    expect(err.code).toBe("io_error");
    expect(err.category).toBe("system");
    expect(err.cause).toBe(native);
  });

  it("maps non-Error unknown to unknown category", () => {
    const err = translateNativeError(42, { operation: "weird" });
    expect(err.code).toBe("unknown");
    expect(err.category).toBe("unknown");
  });

  it("passes through existing PlatformError", () => {
    const existing = new PlatformError("invalid_input", "bad");
    expect(translateNativeError(existing, { operation: "x" })).toBe(existing);
  });
});
