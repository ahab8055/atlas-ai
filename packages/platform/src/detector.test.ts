import { describe, expect, it } from "vitest";

import { createPlatformDetector } from "./detector.js";
import type { OsProbe } from "./probe.js";

function mockProbe(
  partial: Partial<OsProbe> & Pick<OsProbe, "platform">,
): OsProbe {
  return {
    arch: () => "arm64",
    release: () => "24.0.0",
    type: () => "Darwin",
    version: () => "Darwin Kernel Version 24.0.0",
    nodeVersion: () => "22.16.0",
    ...partial,
  };
}

describe("PlatformDetector", () => {
  it("detects darwin as macos with kernel and runtime", () => {
    const info = createPlatformDetector({
      probe: mockProbe({
        platform: () => "darwin",
        arch: () => "arm64",
        release: () => "24.5.0",
        type: () => "Darwin",
        nodeVersion: () => "22.0.0-test",
      }),
    }).detect();

    expect(info.id).toBe("darwin");
    expect(info.os).toBe("macos");
    expect(info.arch).toBe("arm64");
    expect(info.kernelVersion).toBe("24.5.0");
    expect(info.osType).toBe("Darwin");
    expect(info.runtime).toEqual({ kind: "node", version: "22.0.0-test" });
  });

  it("maps linux and win32 to friendly os names", () => {
    const linux = createPlatformDetector({
      probe: mockProbe({
        platform: () => "linux",
        type: () => "Linux",
        release: () => "6.8.0",
      }),
    }).detect();
    expect(linux.id).toBe("linux");
    expect(linux.os).toBe("linux");
    expect(linux.kernelVersion).toBe("6.8.0");

    const win = createPlatformDetector({
      probe: mockProbe({
        platform: () => "win32",
        arch: () => "x64",
        type: () => "Windows_NT",
        release: () => "10.0.22631",
      }),
    }).detect();
    expect(win.id).toBe("win32");
    expect(win.os).toBe("windows");
    expect(win.arch).toBe("x64");
  });

  it("throws on unsupported platform", () => {
    expect(() =>
      createPlatformDetector({
        probe: mockProbe({ platform: () => "freebsd" }),
      }).detect(),
    ).toThrow(/Unsupported platform/);
  });

  it("omits osVersion when probe returns undefined", () => {
    const info = createPlatformDetector({
      probe: mockProbe({
        platform: () => "linux",
        version: () => undefined,
      }),
    }).detect();
    expect(info.osVersion).toBeUndefined();
  });
});
