import { describe, expect, it } from "vitest";

import {
  EventBus,
  PLATFORM_EVENTS,
  createPlatformEventPublisher,
  isPlatformEventType,
  publishPlatformEvent,
} from "./index.js";
import type { AtlasEvent } from "./types.js";

describe("platform event bridge", () => {
  it("publishes platform events with atlas.platform source", () => {
    const bus = new EventBus();
    const received: AtlasEvent[] = [];
    bus.subscribe("PlatformDetected", (event) => {
      received.push(event);
    });

    publishPlatformEvent(
      bus,
      "PlatformDetected",
      {
        platformId: "darwin",
        os: "macos",
        arch: "arm64",
      },
      { traceId: "trace-42" },
    );

    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      type: "PlatformDetected",
      source: "atlas.platform",
      traceId: "trace-42",
      payload: {
        platformId: "darwin",
        os: "macos",
        arch: "arm64",
      },
    });
  });

  it("createPlatformEventPublisher forwards to the bus", () => {
    const bus = new EventBus();
    const types: string[] = [];
    bus.subscribe("*", (event) => {
      types.push(event.type);
    });

    const publisher = createPlatformEventPublisher(bus);
    publisher.publish(
      "PermissionDenied",
      {
        operation: "files.readText",
        capability: "filesystem.read",
        reason: "denied",
      },
      { traceId: "t1" },
    );

    expect(types).toEqual(["PermissionDenied"]);
    expect(bus.getHistory()[0]?.source).toBe("atlas.platform");
  });

  it("exports PLATFORM_EVENTS for subscribers", () => {
    expect(PLATFORM_EVENTS).toContain("PlatformProviderFailed");
    expect(isPlatformEventType("PlatformServicesStarted")).toBe(true);
  });
});
