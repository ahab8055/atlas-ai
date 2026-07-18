import { describe, expect, it } from "vitest";

import { createPlatformManager } from "@atlas-ai/platform";

import { createSystemStateProvider } from "./system-state.js";

const intent = {
  name: "system.status",
  category: "system" as const,
  goal: "status",
  confidence: 1,
  known: true as const,
  parameters: {},
  capabilities: [],
  complexity: "low" as const,
};

describe("createSystemStateProvider", () => {
  it("uses injected PlatformInfo instead of host process", () => {
    const info = createPlatformManager({
      platformId: "win32",
      arch: "x64",
      nodeVersion: "22.0.0-test",
      kernelVersion: "10.0.22631",
    }).getServices().info;

    const provider = createSystemStateProvider(info);
    const contribution = provider.load({
      request: {
        sessionId: "s1",
        text: "status",
        source: "cli",
      },
      intent,
    });

    expect(contribution.systemState?.platform).toBe("win32");
    expect(contribution.systemState?.arch).toBe("x64");
    expect(contribution.systemState?.nodeVersion).toBe("22.0.0-test");
    expect(contribution.systemState?.kernelVersion).toBe("10.0.22631");
  });
});
