import { describe, expect, it, vi } from "vitest";

import { createNodeOsProbe } from "./probe.js";

describe("createNodeOsProbe", () => {
  it("returns shaped fields from the host process", () => {
    const probe = createNodeOsProbe();
    expect(["darwin", "linux", "win32"]).toContain(probe.platform());
    expect(typeof probe.arch()).toBe("string");
    expect(probe.arch().length).toBeGreaterThan(0);
    expect(typeof probe.release()).toBe("string");
    expect(typeof probe.type()).toBe("string");
    expect(typeof probe.nodeVersion()).toBe("string");
    const version = probe.version();
    expect(version === undefined || typeof version === "string").toBe(true);
  });

  it("returns undefined osVersion when os.version throws", async () => {
    vi.resetModules();
    vi.doMock("node:os", async () => {
      const actual = await vi.importActual<typeof import("node:os")>("node:os");
      return {
        ...actual,
        default: {
          ...actual,
          version: () => {
            throw new Error("unavailable");
          },
        },
        version: () => {
          throw new Error("unavailable");
        },
      };
    });
    const { createNodeOsProbe: createProbe } = await import("./probe.js");
    expect(createProbe().version()).toBeUndefined();
    vi.doUnmock("node:os");
    vi.resetModules();
  });
});
