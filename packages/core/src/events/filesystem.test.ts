import { describe, expect, it } from "vitest";

import { EventBus, createFileSystemEventPublisher } from "./index.js";

describe("createFileSystemEventPublisher", () => {
  it("delivers FileCreated to EventBus subscribers", () => {
    const bus = new EventBus({ historyLimit: 10 });
    const publisher = createFileSystemEventPublisher(bus);
    const seen: string[] = [];
    bus.subscribe("FileCreated", (event) => {
      seen.push(String((event.payload as { path: string }).path));
    });

    publisher.publish("FileCreated", {
      path: "/workspace/a.ts",
      isDirectory: false,
      watchId: "w1",
      root: "/workspace",
    });

    expect(seen).toEqual(["/workspace/a.ts"]);
    const hist = bus.getHistory();
    expect(hist[0]?.source).toBe("atlas.filesystem");
    expect(hist[0]?.type).toBe("FileCreated");
  });
});
