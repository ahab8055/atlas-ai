import { describe, expect, it } from "vitest";

import {
  assertAtlasEvent,
  CORE_EVENTS,
  EventBus,
  isCoreEventType,
  publishCoreEvent,
} from "./index.js";
import type { AtlasEvent } from "./types.js";

describe("EventBus", () => {
  it("allows components to publish and subscribe", () => {
    const bus = new EventBus({ historyLimit: 50 });
    const received: AtlasEvent[] = [];

    const unsubscribe = bus.subscribe("IntentDetected", (event) => {
      received.push(event);
    });

    const published = bus.publish({
      type: "IntentDetected",
      source: "test.component",
      traceId: "trace-1",
      payload: { intent: "echo", known: true },
    });

    expect(published.id).toMatch(/^evt_/);
    expect(published.type).toBe("IntentDetected");
    expect(published.source).toBe("test.component");
    expect(published.traceId).toBe("trace-1");
    expect(published.payload).toEqual({ intent: "echo", known: true });
    expect(typeof published.timestamp).toBe("string");

    expect(received).toHaveLength(1);
    expect(received[0]?.id).toBe(published.id);

    unsubscribe();
    bus.publish({
      type: "IntentDetected",
      source: "test.component",
      payload: {},
    });
    expect(received).toHaveLength(1);
  });

  it("delivers wildcard subscriptions for all events", () => {
    const bus = new EventBus();
    const types: string[] = [];
    bus.subscribe("*", (event) => {
      types.push(event.type);
    });

    bus.publish({ type: "RequestReceived", source: "a", payload: {} });
    bus.publish({ type: "PlanCreated", source: "a", payload: {} });

    expect(types).toEqual(["RequestReceived", "PlanCreated"]);
  });

  it("supports once() and records history", () => {
    const bus = new EventBus({ historyLimit: 10 });
    let count = 0;
    bus.once("ExecutionCompleted", () => {
      count += 1;
    });

    bus.publish({
      type: "ExecutionCompleted",
      source: "pipeline",
      payload: {},
    });
    bus.publish({
      type: "ExecutionCompleted",
      source: "pipeline",
      payload: {},
    });

    expect(count).toBe(1);
    expect(bus.getHistory()).toHaveLength(2);
    expect(bus.listenerCount("ExecutionCompleted")).toBe(0);
  });

  it("publishCoreEvent emits typed core orchestration events", () => {
    const bus = new EventBus();
    const event = publishCoreEvent(
      bus,
      "RequestReceived",
      {
        stage: "normalize",
        inputSource: "cli",
        sessionId: "s1",
        textLength: 4,
      },
      { traceId: "t1" },
    );

    expect(event.type).toBe("RequestReceived");
    expect(event.source).toBe("atlas.pipeline");
    expect(event.payload.inputSource).toBe("cli");
    expect(isCoreEventType(event.type)).toBe(true);
    assertAtlasEvent(event);
  });

  it("documents the core event set from Architecture/22", () => {
    expect([...CORE_EVENTS]).toEqual([
      "RequestReceived",
      "IntentDetected",
      "ContextLoaded",
      "PlanCreated",
      "ExecutionStarted",
      "ExecutionCompleted",
      "ResponseGenerated",
    ]);
  });
});
