import { describe, expect, it } from "vitest";

import { createMemoryManager } from "../manager.js";
import { createShortTermMemory } from "./index.js";

describe("ShortTermMemory", () => {
  it("trims oldest turns when over maxEntries", () => {
    const stm = createShortTermMemory({ maxEntries: 2, ttlMs: 0 });
    stm.append("s1", {
      role: "user",
      text: "one",
      at: "2026-01-01T00:00:00.000Z",
    });
    stm.append("s1", {
      role: "assistant",
      text: "two",
      at: "2026-01-01T00:00:01.000Z",
    });
    stm.append("s1", {
      role: "user",
      text: "three",
      at: "2026-01-01T00:00:02.000Z",
    });

    const turns = stm.getTurns("s1");
    expect(turns).toHaveLength(2);
    expect(turns.map((t) => t.text)).toEqual(["two", "three"]);
  });

  it("expires turns older than ttlMs", () => {
    let now = Date.parse("2026-01-01T12:00:00.000Z");
    const stm = createShortTermMemory({
      maxEntries: 10,
      ttlMs: 60_000,
      now: () => now,
    });
    stm.append("s1", {
      role: "user",
      text: "old",
      at: "2026-01-01T11:58:00.000Z",
    });
    stm.append("s1", {
      role: "user",
      text: "fresh",
      at: "2026-01-01T11:59:30.000Z",
    });

    now = Date.parse("2026-01-01T12:00:00.000Z");
    const turns = stm.getTurns("s1");
    expect(turns).toHaveLength(1);
    expect(turns[0]?.text).toBe("fresh");
  });

  it("isolates sessions", () => {
    const stm = createShortTermMemory({ maxEntries: 10, ttlMs: 0 });
    stm.append("a", {
      role: "user",
      text: "from-a",
      at: "2026-01-01T00:00:00.000Z",
    });
    stm.append("b", {
      role: "user",
      text: "from-b",
      at: "2026-01-01T00:00:00.000Z",
    });
    expect(stm.getTurns("a").map((t) => t.text)).toEqual(["from-a"]);
    expect(stm.getTurns("b").map((t) => t.text)).toEqual(["from-b"]);
    stm.clear("a");
    expect(stm.getTurns("a")).toEqual([]);
    expect(stm.getTurns("b")).toHaveLength(1);
  });

  it("exposes ConversationStore adapter", () => {
    const stm = createShortTermMemory({ maxEntries: 5, ttlMs: 0 });
    const store = stm.toConversationStore();
    store.append("s", {
      role: "user",
      text: "hello",
      intentName: "chat",
      at: "2026-01-01T00:00:00.000Z",
    });
    expect(store.getTurns("s")).toHaveLength(1);
    store.clear("s");
    expect(store.getTurns("s")).toEqual([]);
  });

  it("mirrors turns into working memory when manager is set", async () => {
    const memoryManager = createMemoryManager();
    const stm = createShortTermMemory({
      maxEntries: 5,
      ttlMs: 0,
      memoryManager,
    });
    stm.append("sess", {
      role: "user",
      text: "remember me",
      at: "2026-01-01T00:00:00.000Z",
    });

    await new Promise((r) => setTimeout(r, 20));
    const mirrored = await memoryManager.query({
      type: "working",
      sessionId: "sess",
    });
    expect(mirrored.some((m) => m.content === "remember me")).toBe(true);
    expect(mirrored[0]?.metadata?.kind).toBe("conversation_turn");
  });

  it("reports config", () => {
    const stm = createShortTermMemory({ maxEntries: 12, ttlMs: 1000 });
    expect(stm.getConfig()).toEqual({ maxEntries: 12, ttlMs: 1000 });
  });
});
