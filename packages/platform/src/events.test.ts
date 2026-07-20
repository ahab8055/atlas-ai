import { describe, expect, it } from "vitest";

import {
  PLATFORM_EVENTS,
  emitPlatformEvent,
  isPlatformEventType,
} from "./events.js";

describe("platform events", () => {
  it("defines the PLATFORM_EVENTS catalog", () => {
    expect(PLATFORM_EVENTS).toEqual([
      "PlatformDetected",
      "PlatformServicesStarted",
      "PermissionDenied",
      "PlatformProviderFailed",
    ]);
    expect(isPlatformEventType("PermissionDenied")).toBe(true);
    expect(isPlatformEventType("Unknown")).toBe(false);
  });

  it("emitPlatformEvent no-ops without a publisher", () => {
    expect(() =>
      emitPlatformEvent(undefined, "PlatformDetected", {
        platformId: "linux",
        os: "linux",
        arch: "x64",
      }),
    ).not.toThrow();
  });
});
